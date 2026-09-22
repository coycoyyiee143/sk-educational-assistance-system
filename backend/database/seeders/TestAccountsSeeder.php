<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Opt-in seeder (run explicitly with `--class=TestAccountsSeeder`, not part
 * of the default DatabaseSeeder chain) for QA/testers who need staff-role
 * accounts without setting up a real Google Authenticator app.
 *
 * Each account is pre-seeded with google2fa_enabled_at already set, so
 * login skips the QR-enrollment step, and with google2fa_secret set to
 * TwoFactorService::STATIC_TEST_SECRET, so TwoFactorService::verify()
 * accepts the fixed code 123456 instead of running real TOTP.
 *
 * Deliberately separate emails from OpeningDaySeeder's admin@/superadmin@/
 * verifier@ accounts — those keep requiring a real authenticator app.
 *
 * firstOrCreate throughout — safe to re-run without duplicating anything.
 */
class TestAccountsSeeder extends Seeder
{
    public function run(): void
    {
        $staticSecret = encrypt(TwoFactorService::STATIC_TEST_SECRET);

        User::firstOrCreate(
            ['email' => 'testadmin@skmamatid.com'],
            [
                'first_name'            => 'Test',
                'middle_name'           => 'QA',
                'last_name'             => 'Admin',
                'mobile_number'         => '09301111111',
                'password'              => Hash::make('pass1234'),
                'role'                  => 'sk_admin',
                'is_active'             => true,
                'email_verified_at'     => now(),
                'google2fa_secret'      => $staticSecret,
                'google2fa_enabled_at'  => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'testsuperadmin@skmamatid.com'],
            [
                'first_name'            => 'Test',
                'middle_name'           => 'QA',
                'last_name'             => 'Superadmin',
                'mobile_number'         => '09302222222',
                'password'              => Hash::make('pass1234'),
                'role'                  => 'superadmin',
                'is_active'             => true,
                'email_verified_at'     => now(),
                'google2fa_secret'      => $staticSecret,
                'google2fa_enabled_at'  => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'testverifier1@skmamatid.com'],
            [
                'first_name'            => 'Test',
                'middle_name'           => 'QA',
                'last_name'             => 'Verifier One',
                'mobile_number'         => '09303333333',
                'password'              => Hash::make('pass1234'),
                'role'                  => 'sk_verifier',
                'is_active'             => true,
                'email_verified_at'     => now(),
                'google2fa_secret'      => $staticSecret,
                'google2fa_enabled_at'  => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'testverifier2@skmamatid.com'],
            [
                'first_name'            => 'Test',
                'middle_name'           => 'QA',
                'last_name'             => 'Verifier Two',
                'mobile_number'         => '09304444444',
                'password'              => Hash::make('pass1234'),
                'role'                  => 'sk_verifier',
                'is_active'             => true,
                'email_verified_at'     => now(),
                'google2fa_secret'      => $staticSecret,
                'google2fa_enabled_at'  => now(),
            ]
        );

        $this->command->info(
            'TestAccountsSeeder complete: testadmin@skmamatid.com, testsuperadmin@skmamatid.com, '
            . 'testverifier1@skmamatid.com, testverifier2@skmamatid.com — password pass1234 for all, '
            . '2FA code 123456 for all (no real authenticator app needed).'
        );
    }
}
