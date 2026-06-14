<?php

namespace Database\Seeders;

use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Test Admin Account
        $admin = User::create([
            'first_name'        => 'SK Admin',
            'middle_name'       => 'Mamatid',
            'last_name'         => 'Official',
            'email'             => 'admin@skmamatid.com',
            'mobile_number'     => '09123456789',
            'password'          => Hash::make('admin123'),
            'role'              => 'sk_admin',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        // Test Verifier Account
        User::create([
            'first_name'        => 'SK Verifier',
            'middle_name'       => 'Mamatid',
            'last_name'         => 'Official',
            'email'             => 'verifier@skmamatid.com',
            'mobile_number'     => '09876543210',
            'password'          => Hash::make('verifier123'),
            'role'              => 'sk_verifier',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        // Active Application Period — required before anyone can submit an application
        ApplicationConfiguration::create([
            'school_year' => '2025-2026',
            'semester'    => '2nd Semester',
            'open_date'   => now()->subDays(5),
            'close_date'  => now()->addDays(30),
            'total_slots' => 2000,
            'used_slots'  => 0,
            'is_active'   => true,
            'created_by'  => $admin->id,
        ]);
    }
}