<?php

namespace Database\Seeders;

use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Clean "day one" scenario — the application period has genuinely opened
 * (open_date is in the past, close_date in the future, is_active true),
 * but zero applicants exist yet. Only the admin and verifier accounts are
 * seeded.
 *
 * Use this for end-to-end testing that starts from registration —
 * register a fresh applicant account through the real /register UI
 * (unlike ActivePeriodSeeder's factory-inserted applicants, this gives
 * you a real FaceVerification record), then submit an application and
 * upload real documents to exercise OCR + forgery detection for real.
 *
 * Different from FreshPeriodSeeder: that one has the period NOT open
 * yet (for testing open/close date enforcement). This one has the
 * period already open — for testing the actual submission flow without
 * any placeholder applicant noise in the way.
 */
class OpeningDaySeeder extends Seeder
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

        ApplicationConfiguration::create([
            'school_year'  => '2025-2026',
            'open_date'    => now()->subHours(1),
            'close_date'   => now()->addDays(14)->endOfDay(),
            'slot_limit'   => 2000,
            'slots_filled' => 0,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);

        // Deliberately no applicants, no applications, no documents —
        // this seeder's entire point is a blank slate.
    }
}