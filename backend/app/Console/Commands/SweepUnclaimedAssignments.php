<?php

namespace App\Console\Commands;

use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\AuditLog;
use Illuminate\Console\Command;

class SweepUnclaimedAssignments extends Command
{
    protected $signature = 'claiming:sweep-unclaimed';

    protected $description = 'Flips past-due pending_claiming assignments to unclaimed, and reassigns eligible original no-shows into a Late Claiming retry slot if Late Claiming is still open.';

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
                // Waitlist promotions and late-claiming retries both sit on
                // the flexible "Late Claiming" lane — not tied to
                // one calendar day, since the whole point of Late Claiming
                // is walking in any day within the window. Only overdue
                // once Late Claiming ITSELF has ended.
                ->orWhere(function ($q3) {
                    $q3->whereIn('source', ['waitlist_promotion', 'late_claiming_retry'])
                       ->whereHas('schedule', fn($s) => $s->where(function ($s2) {
                           $s2->whereNull('late_claiming_end_date')
                              ->orWhere('late_claiming_end_date', '<', now()->toDateString());
                       }));
                });
            })
            ->get();

        $flippedFinal = 0;
        $reassigned = 0;

        foreach ($overdue as $assignment) {
            $schedule = $assignment->schedule;
            $wasOriginal = $assignment->source === 'original';
            $lateClaimingStillOpen = $schedule
                && $schedule->late_claiming_date
                && $schedule->late_claiming_end_date
                && now()->toDateString() <= $schedule->late_claiming_end_date;

            // Only 'original' rows can still have Late Claiming ahead of
            // them at this point — anything already on the flex lane that
            // reached this query has, by definition, had Late Claiming end.
            if ($wasOriginal && $lateClaimingStillOpen) {
                AuditLog::record(
                    'claiming_missed_slot',
                    $assignment->application,
                    "Application #{$assignment->application_id} missed its original claiming slot ({$assignment->lane->lane_name}, {$assignment->lane->claiming_date}) — reassigned to Late Claiming."
                );

                $lateClaimingLane = ClaimingLane::firstOrCreate(
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'lane_name'            => 'Late Claiming',
                    ],
                    [
                        'batch'         => 'morning',
                        'claiming_date' => $schedule->late_claiming_date,
                        'capacity'      => null,
                    ]
                );

                $assignment->update([
                    'claiming_lane_id' => $lateClaimingLane->id,
                    'claim_status'     => 'pending_claiming',
                    'source'           => 'late_claiming_retry',
                ]);
                // Application.status intentionally NOT touched here — a
                // retry reassignment is not a resolution, the applicant
                // still has an active pending chance to claim. It stays
                // whatever it already was ('approved').
                $reassigned++;
                continue;
            }

            // Late Claiming has genuinely ended (or was never configured
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
                    ? "Application #{$assignment->application_id} did not claim during its original slot, and Late Claiming has ended — marked permanently unclaimed."
                    : "Application #{$assignment->application_id} (source: {$assignment->source}) did not claim during Late Claiming, which has now ended — marked permanently unclaimed."
            );
        }

        $this->info("Sweep complete: {$reassigned} reassigned to Late Claiming, {$flippedFinal} marked permanently unclaimed.");

        return self::SUCCESS;
    }
}
