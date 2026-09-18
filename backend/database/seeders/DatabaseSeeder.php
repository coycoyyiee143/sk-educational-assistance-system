<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Always seed OpeningDaySeeder first — every other seeder below
        // assumes its 4 accounts already exist and looks them up rather
        // than recreating them. Then uncomment whichever scenario(s) you
        // want stacked on top:
        $this->call(OpeningDaySeeder::class); // base: 4 staff accounts + an open application period

        //$this->call(FreshPeriodSeeder::class); // for testing admin settings / etc.
        //$this->call(ActivePeriodSeeder::class); // for testing ocr / etc.
        //$this->call(DemoDataSeeder::class); // for testing reports / admin features / etc.
        //$this->call(BudgetScaleTestSeeder::class); // for budget forecasting
        //$this->call(WaitlistScenarioSeeder::class); // for testing waitlist / Late Claiming / promotion
        //$this->call(ClaimingFaceTestSeeder::class); // for testing face verification during claiming
        //$this->call(FullDemoSeeder::class); // for admin reports, budget tools and claiming/waitlist
        //$this->call(VerifierClaimingUiTestSeeder::class); // for testing VerifierClaiming.jsx layout/UI: multiple lanes, statuses, and Late Claiming sources at once
        //$this->call(MainSeeder::class); // full scenario, two verifiers, tests Reviewed By / Disbursed By
        //$this->call(BudgetToolsDemoSeeder::class); // for demoing all 4 budget tools (Allocation Planning, Analysis, Unmet Demand Tracker, Forecast) with a clear 5-cycle demand story
    }
}