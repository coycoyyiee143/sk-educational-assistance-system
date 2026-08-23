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
        $this->call(FullDemoSeeder::class); // for admin reports, budget tools and claiming/waitlist
    }
}