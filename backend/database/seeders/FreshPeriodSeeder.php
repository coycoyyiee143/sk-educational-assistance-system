<?php

namespace Database\Seeders;

use App\Models\ApplicationConfiguration;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FreshPeriodSeeder extends Seeder
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

        // Period hasn't opened yet — open_date is in the future, so Admin
        // Settings should show all fields as editable. No applications
        // exist yet since nobody could have submitted one.
        ApplicationConfiguration::create([
            'school_year'  => '2026-2027',
            'open_date'    => now()->addDays(2)->startOfDay(),
            'close_date'   => now()->addDays(15)->endOfDay(),
            'slot_limit'   => 2000,
            'slots_filled' => 0,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);

        // Applicant account, registered but hasn't applied yet — complete
        // profile, matching what Register actually produces now that DOB
        // and barangay are required fields there.
        $applicant = User::create([
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

        StudentProfile::create([
            'user_id'             => $applicant->id,
            'birthdate'           => '2010-08-08',
            'barangay'            => 'Mamatid',
            'is_profile_complete' => true,
        ]);
    }
}