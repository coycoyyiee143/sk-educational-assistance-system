<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Wipes out both demo scenarios (ClaimingDayTestSeeder and
 * WaitlistScenarioSeeder) and reactivates the real, non-demo
 * ApplicationConfiguration, so the verifier side goes back to showing
 * only genuine applications.
 *
 * Meant to be run right before switching the demo video back to "real
 * applications" mode after having shown either seeded scenario — run this,
 * then AdminVerifierOnlySeeder-style manual login isn't needed, everything
 * just goes back to what was there before any demo seeding happened.
 *
 * Never touches config/applications/users outside these two scenarios'
 * school_year values, so your own and your groupmate's real submitted
 * applications are always left exactly as they are.
 */
class CleanSlateSeeder extends Seeder
{
    private const DEMO_SCHOOL_YEARS = [
        ClaimingDayTestSeeder::SCHOOL_YEAR,
        WaitlistScenarioSeeder::SCHOOL_YEAR,
    ];

    public function run(): void
    {
        foreach (self::DEMO_SCHOOL_YEARS as $schoolYear) {
            $this->wipeScenario($schoolYear);
        }

        $this->reactivateRealConfig();
    }

    private function wipeScenario(string $schoolYear): void
    {
        $configIds = ApplicationConfiguration::where('school_year', $schoolYear)->pluck('id');
        if ($configIds->isEmpty()) {
            $this->command->info("Nothing to clean for \"{$schoolYear}\" — already clean.");
            return;
        }

        $userIds = Application::whereIn('config_id', $configIds)->pluck('user_id');
        $deletedUsers = User::whereIn('id', $userIds)->where('role', 'applicant')->delete();

        $scheduleIds = ClaimingSchedule::whereIn('config_id', $configIds)->pluck('id');
        ClaimingLane::whereIn('claiming_schedule_id', $scheduleIds)->delete();
        ClaimingSchedule::whereIn('id', $scheduleIds)->delete();

        ApplicationConfiguration::whereIn('id', $configIds)->delete();

        $this->command->info("Cleaned \"{$schoolYear}\": removed {$deletedUsers} demo applicant(s) and their applications/assignments.");
    }

    /**
     * Reactivates whichever ApplicationConfiguration is NOT one of the demo
     * scenarios above (matched by excluding "Test" from school_year, which
     * both demo scenarios' names always contain). If that's ambiguous —
     * zero or more than one candidate — it's left for you to activate
     * manually via the admin UI instead of guessing wrong.
     */
    private function reactivateRealConfig(): void
    {
        $candidates = ApplicationConfiguration::where('school_year', 'not like', '%Test%')->get();

        if ($candidates->count() !== 1) {
            $this->command->warn(
                "Could not auto-reactivate a config — found {$candidates->count()} non-demo candidate(s). "
                . 'Activate the real one manually from the admin panel.'
            );
            return;
        }

        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);
        $candidates->first()->update(['is_active' => true]);

        $this->command->info("Reactivated real config: \"{$candidates->first()->school_year}\".");
    }
}
