<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Minimal seeder: just the two staff accounts (SK Admin, SK Verifier),
 * no applications, no periods, no test applicants. Use this when you
 * want a clean slate to manually test every flow yourself (create your
 * own application period, register as an applicant through the actual
 * UI, etc.) instead of starting from pre-built scenario data.
 */
class AdminVerifierOnlySeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => 'admin@skmamatid.com'],
            [
                'first_name'        => 'SK Admin',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09123456789',
                'password'          => Hash::make('admin123'),
                'role'              => 'sk_admin',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'verifier@skmamatid.com'],
            [
                'first_name'        => 'SK Verifier',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09876543210',
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        $this->command->info('AdminVerifierOnlySeeder complete: admin@skmamatid.com / admin123 and verifier@skmamatid.com / verifier123 created.');
    }
}