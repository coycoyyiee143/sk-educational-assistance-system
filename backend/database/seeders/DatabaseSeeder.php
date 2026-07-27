<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Comment/uncomment whichever scenario you want to seed:
        $this->call(FreshPeriodSeeder::class);
        // $this->call(ActivePeriodSeeder::class);
    }
}