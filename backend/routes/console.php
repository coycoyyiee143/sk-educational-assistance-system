<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Console\Commands\CheckBackupHealth;
use App\Console\Commands\RetryFailedOcrDocuments;
use App\Console\Commands\SendClaimingReminders;
use App\Console\Commands\SweepUnclaimedAssignments;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(SendClaimingReminders::class)->dailyAt('08:00');
Schedule::command(SweepUnclaimedAssignments::class)->dailyAt('22:00');
Schedule::command(RetryFailedOcrDocuments::class)->everyTenMinutes()->withoutOverlapping();
// Runs after the 2 AM backup (see scripts/backup.sh / BACKUP.md), giving
// it time to land before checking.
Schedule::command(CheckBackupHealth::class)->dailyAt('09:00');