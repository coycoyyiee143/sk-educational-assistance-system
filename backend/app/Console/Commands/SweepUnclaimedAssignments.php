<?php

namespace App\Console\Commands;

use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\AuditLog;
use Illuminate\Console\Command;

class SweepUnclaimedAssignments extends Command
{
    protected $signature = 'claiming:sweep-unclaimed';

    protected $description = 'Flips past-due pending_claiming assignments to unclaimed, and reassigns eligible original no-shows into a grace-period retry slot if grace period is still open.';

    public function handle(): int
    {
        $overdue = ClaimingAssignment::with(['application', 'lane', 'schedule'])
            ->where('claim_status', 'pending_claiming')
            ->where(function ($q) {
                // Original assignments: overdue once their own specific
                // scheduled lane date has passed.
                $q->where(function ($q2) {
                    $q2->where('source', 'original')
                       ->whereHas('lane', fn($l) => $l->where('claiming_date', '<', now()->toDateString()));
                })
                // Waitlist promotions and grace-period retries both sit on
                // the flexible "Grace Period Claiming" lane — not tied to
                // one calendar day, since the whole point of grace period
                // is walking in any day within the window. Only overdue
                // once the grace period ITSELF has ended.
                ->orWhere(function ($q3) {
                    $q3->whereIn('source', ['waitlist_promotion', 'grace_period_retry'])
                       ->whereHas('schedule', fn($s) => $s->whereNotNull('grace_period_end_date')
                           ->where('grace_period_end_date', '<', now()->toDateString()));
                });
            })
            ->get();

        $flippedFinal = 0;
        $reassigned = 0;

        foreach ($overdue as $assignment) {
            $schedule = $assignment->schedule;
            $wasOriginal = $assignment->source === 'original';
            $graceStillOpen = $schedule
                && $schedule->grace_period_date
                && $schedule->grace_period_end_date
                && now()->toDateString() <= $schedule->grace_period_end_date;

            // Only 'original' rows can still have grace period ahead of
            // them at this point — anything already on the flex lane that
            // reached this query has, by definition, had grace period end.
            if ($wasOriginal && $graceStillOpen) {
                AuditLog::record(
                    'claiming_missed_slot',
                    $assignment->application,
                    "Application #{$assignment->application_id} missed its original claiming slot ({$assignment->lane->lane_name}, {$assignment->lane->claiming_date}) — reassigned to grace period."
                );

                $graceLane = ClaimingLane::firstOrCreate(
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'lane_name'            => 'Grace Period Claiming',
                    ],
                    [
                        'batch'         => 'morning',
                        'claiming_date' => $schedule->grace_period_date,
                        'capacity'      => null,
                    ]
                );

                $assignment->update([
                    'claiming_lane_id' => $graceLane->id,
                    'claim_status'     => 'pending_claiming',
                    'source'           => 'grace_period_retry',
                ]);
                // Application.status intentionally NOT touched here — a
                // retry reassignment is not a resolution, the applicant
                // still has an active pending chance to claim. It stays
                // whatever it already was ('approved').
                $reassigned++;
                continue;
            }

            // Grace period has genuinely ended (or was never configured
            // with an end date) — this is now final, regardless of
            // source. Sync Application.status alongside claim_status,
            // mirroring exactly what VerifierController::updateClaimStatus()
            // already does for claimed/not_cleared. Without this,
            // Application.status stays stuck at 'approved' forever for a
            // finalized no-show — AdminReportController::applyFilters()'s
            // direct status-filter map ('Unclaimed' => ['unclaimed']) would
            // silently return zero results even when genuinely-unclaimed
            // applicants exist, since it filters on Application.status,
            // not ClaimingAssignment.claim_status.
            $assignment->update(['claim_status' => 'unclaimed']);
            $assignment->application->update(['status' => 'unclaimed']);
            $flippedFinal++;
            AuditLog::record(
                'claiming_unclaimed_final',
                $assignment->application,
                $wasOriginal
                    ? "Application #{$assignment->application_id} did not claim during its original slot, and grace period has ended — marked permanently unclaimed."
                    : "Application #{$assignment->application_id} (source: {$assignment->source}) did not claim during grace period, which has now ended — marked permanently unclaimed."
            );
        }

        $this->info("Sweep complete: {$reassigned} reassigned to grace period, {$flippedFinal} marked permanently unclaimed.");

        return self::SUCCESS;
    }
}