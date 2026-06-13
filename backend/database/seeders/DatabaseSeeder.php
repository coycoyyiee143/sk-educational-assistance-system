<?php

namespace Database\Seeders;

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
        User::create([
            'first_name' => 'SK Admin',
            'middle_name' => 'Mamatid',
            'last_name' => 'Official',
            'email' => 'sk@sk.com',
            'mobile_number' => '09171234567',
            'password' => Hash::make('sksk123'),
            'role' => 'sk_admin',
            'is_active' => true,
        ]);

        // Test Verifier Account
        User::create([
            'first_name' => 'Maria',
            'middle_name' => 'Longasa',
            'last_name' => 'Gonzales',
            'email' => 'verifier@sk.com',
            'mobile_number' => '09123456789',
            'password' => Hash::make('verifier123'),
            'role' => 'sk_verifier',
            'is_active' => true,
        ]);

        // Test Applicant Account
        User::create([
            'first_name' => 'Regina Grace',
            'middle_name' => 'Antido',
            'last_name' => 'Ayes',
            'email' => 'regreg@sk.com',
            'mobile_number' => '09987654321',
            'password' => Hash::make('regreg123'),
            'role' => 'applicant',
            'is_active' => true,
        ]);
    }
}