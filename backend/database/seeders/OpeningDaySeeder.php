<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Base seeder — always seed this one first, then stack any other scenario
 * seeder on top of it. Every other seeder in this folder assumes these
 * four accounts already exist and looks them up rather than recreating
 * them (see e.g. VerifierClaimingUiTestSeeder::run()).
 *
 * Deliberately ONLY the 4 staff accounts — no application period, no
 * applicants. That's what makes it safe to stack anything else on top:
 * almost every scenario seeder creates its own ApplicationConfiguration
 * with is_active=true, and this app only really expects one active period
 * at a time, so this seeder staying out of that business entirely avoids
 * a collision. If you want a genuinely empty "day one" period to register
 * a real applicant into yourself, create one manually via Admin Settings
 * after seeding this.
 *
 * firstOrCreate throughout — safe to re-run without duplicating anything,
 * and safe whether it runs before or after a scenario seeder that expects
 * these same accounts to already exist.
 */
class OpeningDaySeeder extends Seeder
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

        User::firstOrCreate(
            ['email' => 'superadmin@skmamatid.com'],
            [
                'first_name'        => 'SK Superadmin',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09111111111',
                'password'          => Hash::make('superadmin123'),
                'role'              => 'superadmin',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'itsupport@skmamatid.com'],
            [
                'first_name'        => 'SK IT Support',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09222222222',
                'password'          => Hash::make('itsupport123'),
                'role'              => 'it_support',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        // Deliberately no application period, no applicants, no
        // applications, no documents — this seeder's entire point is a
        // blank slate other seeders (or you, manually) can build on.
        $this->command->info('OpeningDaySeeder complete: admin@skmamatid.com/admin123, verifier@skmamatid.com/verifier123, superadmin@skmamatid.com/superadmin123, itsupport@skmamatid.com/itsupport123.');
    }
}
