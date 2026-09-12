<?php

namespace App\Services;

use App\Models\Application;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Notifications\ClaimingScheduleNotification;
use Illuminate\Support\Facades\DB;

/**
 * Single source of truth for putting an approved applicant onto a
 * claiming lane. Two callers, same logic:
 *   1. VerifierController::approve() — real time, one applicant, the
 *      moment they're approved.
 *   2. AdminScheduleController::activate() — a one-time catch-up pass
 *      for anyone already approved before a schedule existed / was
 *      active, or who was approved while every lane was full.
 *
 * FILL ORDER: lanes are filled strictly in order (claiming_date, then
 * id) — Lane 1 fills completely before Lane 2 ever gets anyone, and so
 * on. This is intentional, not a bug: unlike the old batch-publish
 * flow, we can't know the final total applicant count in advance to
 * split evenly, so lanes fill sequentially instead.
 *
 * Every regular lane has a real, required capacity (enforced in
 * AdminScheduleController::store()) — there's no "unlimited" regular
 * lane. If every regular lane is full, assignToLane() simply returns
 * null and the applicant stays 'approved' with no assignment until
 * room opens up. The one uncapped (capacity = null) lane in this
 * system is "Grace Period Claiming", which VerifierController creates
 * directly for waitlist promotions/retries — this service explicitly
 * excludes that lane (see the where() below), so it never enters this
 * fill logic at all.
 */
class ClaimingAssignmentService
{
    /**
     * Assigns one approved application to the first non-full regular
     * lane on its config's currently active schedule. Row-locks the
     * candidate lanes for the duration of the check + insert so two
     * approvals happening at the same moment (two verifiers, or the
     * approve() path racing the catch-up sweep) can never both land in
     * the same lane's last open slot. The claiming_assignments table
     * also has a unique constraint on application_id as a hard backstop.
     *
     * Returns the ClaimingAssignment on success, or null if there's no
     * active schedule yet, or every lane is currently full. In the
     * null case the applicant simply stays 'approved' with no
     * assignment — they'll be picked up the next time activate() runs
     * a catch-up pass, or a future call to this method once a slot
     * frees up (e.g. wired in later to the not_cleared/waitlist flow).
     */
    public static function assignToLane(Application $application): ?ClaimingAssignment
    {
        // Idempotent — safe to call more than once for the same
        // applicant (e.g. approve() already assigned them, then a
        // catch-up sweep runs and would otherwise try again).
        $existing = ClaimingAssignment::where('application_id', $application->id)->first();
        if ($existing) {
            return $existing;
        }

        $assignment = DB::transaction(function () use ($application) {
            $schedule = ClaimingSchedule::where('config_id', $application->config_id)
                ->where('is_active', true)
                ->latest()
                ->first();

            if (!$schedule) {
                return null;
            }

            // Lock every regular (non-Grace-Period-Claiming) lane row for
            // this schedule. A concurrent call hitting the same schedule
            // blocks here until this transaction commits or rolls back,
            // so nobody reads a stale "still has room" snapshot.
            $lanes = ClaimingLane::where('claiming_schedule_id', $schedule->id)
                ->where('lane_name', '!=', 'Grace Period Claiming')
                ->orderBy('claiming_date')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $targetLane = null;
            foreach ($lanes as $lane) {
                $filled = ClaimingAssignment::where('claiming_lane_id', $lane->id)->count();
                if ($filled < $lane->capacity) {
                    $targetLane = $lane;
                    break;
                }
            }

            if (!$targetLane) {
                return null; // every lane full — applicant stays approved, unassigned
            }

            return ClaimingAssignment::create([
                'application_id'       => $application->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $targetLane->id,
                'claim_status'         => 'pending_claiming',
                'source'               => 'original',
            ]);
        });

        if ($assignment) {
            $application->loadMissing('user');
            $assignment->loadMissing('lane', 'schedule');
            $application->user->notify(new ClaimingScheduleNotification(
                $application,
                $assignment->lane,
                $assignment->schedule,
                $assignment
            ));
        }

        return $assignment;
    }

    /**
     * Catch-up pass: assigns every approved application for this
     * schedule's config that doesn't have a ClaimingAssignment yet —
     * covers (a) applicants approved before any schedule was active,
     * and (b) applicants approved while every lane was full. Ordered
     * by control_number so the backlog is worked through fairly, in
     * the same order they were originally approved. Safe to re-run —
     * assignToLane() is idempotent and stops once lanes are full again.
     */
    public static function assignPendingApprovals(ClaimingSchedule $schedule): int
    {
        $applications = Application::with('user')
            ->where('config_id', $schedule->config_id)
            ->where('status', 'approved')
            ->whereNotNull('control_number')
            ->whereDoesntHave('claimingAssignment')
            ->orderBy('control_number')
            ->get();

        $assignedCount = 0;
        foreach ($applications as $app) {
            if (self::assignToLane($app)) {
                $assignedCount++;
            }
        }

        return $assignedCount;
    }
}