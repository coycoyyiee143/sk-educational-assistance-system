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
        // claiming_assignments.application_id is UNIQUE — only one
        // assignment row can ever exist per application. That means a
        // grace-period retry is a MUTATION of the existing row (new
        // lane, new source, claim_status reset to pending_claiming),
        // not a second row — the fact that they missed their original
        // slot lives in the AuditLog entry below, not as a separate
        // claiming_assignments record.
        $overdue = ClaimingAssignment::with(['application', 'lane', 'schedule'])
            ->where('claim_status', 'pending_claiming')
            ->whereHas('lane', function ($q) {
                $q->where('claiming_date', '<', now()->toDateString());
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

            if ($wasOriginal && $graceStillOpen) {
                // Log the missed original slot BEFORE mutating the row,
                // so there's a permanent record of it even though the
                // assignment row itself is about to be reassigned.
                AuditLog::record(
                    'claiming_missed_original_slot',
                    $assignment->application,
                    "Application #{$assignment->application_id} missed its original claiming slot ({$assignment->lane->lane_name}, {$assignment->lane->claiming_date}) — reassigned to grace period."
                );

                $graceLane = ClaimingLane::firstOrCreate(
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'lane_name'            => 'Waitlist Promotions',
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
                $reassigned++;
                continue;
            }

            // Either not eligible for a retry (already was a retry that
            // also lapsed), or grace period has ended — this is now the
            // genuinely final outcome.
            $assignment->update(['claim_status' => 'unclaimed']);
            $flippedFinal++;

            if ($wasOriginal && !$graceStillOpen) {
                AuditLog::record(
                    'claiming_unclaimed_final',
                    $assignment->application,
                    "Application #{$assignment->application_id} did not claim during its original slot, and grace period has ended — marked permanently unclaimed."
                );
            }
        }

        $this->info("Sweep complete: {$reassigned} reassigned to grace period, {$flippedFinal} marked permanently unclaimed.");

        return self::SUCCESS;
    }
}