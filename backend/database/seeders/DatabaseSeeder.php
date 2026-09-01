<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Comment/uncomment whichever scenario you want to seed:
        //$this->call(FreshPeriodSeeder::class); // for testing admin settings / etc.
        //$this->call(ActivePeriodSeeder::class); // for testing ocr / etc.
        //$this->call(DemoDataSeeder::class); // for testing reports / admin features / etc.
        //$this->call(BudgetScaleTestSeeder::class); // for budget forecasting
        //$this->call(WaitlistScenarioSeeder::class); // for testing waitlist / grace period / promotion
        //$this->call(ClaimingFaceTestSeeder::class); // for testing face verification during claiming
        //$this->call(FullDemoSeeder::class); // for admin reports, budget tools and claiming/waitlist
        //$this->call(VerifierClaimingUiTestSeeder::class); // for testing VerifierClaiming.jsx layout/UI: multiple lanes, statuses, and grace period sources at once
        $this->call(OpeningDaySeeder::class); // for testing end to end
    }
}