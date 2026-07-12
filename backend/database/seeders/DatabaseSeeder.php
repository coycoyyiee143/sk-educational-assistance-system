<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
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

        $config = ApplicationConfiguration::create([
            'school_year'  => '2024-2025',
            'open_date'    => now()->subDays(1)->startOfDay(),
            'close_date'   => now()->addDays(13)->endOfDay(),
            'slot_limit'   => 2000,
            'slots_filled' => 1,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);

        // Applicant #1 — approved, has a control number, ready for claiming schedule testing
        $approvedApplicant = User::create([
            'first_name'        => 'Juan',
            'middle_name'       => 'Santos',
            'last_name'         => 'Dela Cruz',
            'email'             => 'applicant1@test.com',
            'mobile_number'     => '09111111111',
            'password'          => Hash::make('applicant123'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        Application::create([
            'user_id'            => $approvedApplicant->id,
            'config_id'          => $config->id,
            'school_name'        => 'Laguna State Polytechnic University',
            'course'             => 'BS Information Technology',
            'year_level'         => '3rd Year',
            'student_id_number'  => '2023-00123',
            'status'             => 'approved',
            'control_number'     => Application::generateControlNumber($config->id),
            'submitted_at'       => now()->subDays(2),
        ]);

        // Applicant #2 — registered account only, no application submitted yet
        User::create([
            'first_name'        => 'Regina Grace',
            'middle_name'       => 'Antido',
            'last_name'         => 'Ayes',
            'email'             => 'reginaga88@gmail.com',
            'mobile_number'     => '09222222222',
            'password'          => Hash::make('12345678'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);
    }
}