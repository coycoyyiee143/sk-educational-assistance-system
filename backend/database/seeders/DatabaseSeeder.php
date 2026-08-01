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
        $this->call(DemoDataSeeder::class); // for testing reports / admin features / etc.
    }
}