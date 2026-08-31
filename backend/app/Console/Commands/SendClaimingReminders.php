<?php

namespace App\Console\Commands;

use App\Models\ClaimingAssignment;
use App\Notifications\ClaimingReminderNotification;
use Illuminate\Console\Command;

class SendClaimingReminders extends Command
{
    protected $signature = 'claiming:send-reminders';
    protected $description = 'Send claiming day reminder emails to applicants scheduled for tomorrow';

    public function handle()
    {
        $tomorrow = now()->addDay()->toDateString();

        $assignments = ClaimingAssignment::with(['application.user', 'lane', 'schedule'])
            ->whereNull('reminder_sent_at')
            ->where('claim_status', 'pending_claiming')
            ->whereHas('lane', function ($q) use ($tomorrow) {
                $q->whereDate('claiming_date', $tomorrow);
            })
            ->get();

        $count = 0;

        foreach ($assignments as $assignment) {
            $assignment->application->user->notify(new ClaimingReminderNotification(
                $assignment->application,
                $assignment->lane,
                $assignment->schedule
            ));

            $assignment->update(['reminder_sent_at' => now()]);
            $count++;
        }

        $this->info("Sent {$count} claiming reminder(s) for {$tomorrow}.");
    }
}