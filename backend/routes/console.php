<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Console\Commands\SendClaimingReminders;
use App\Console\Commands\SweepUnclaimedAssignments;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(SendClaimingReminders::class)->dailyAt('08:00');
Schedule::command(SweepUnclaimedAssignments::class)->dailyAt('22:00');