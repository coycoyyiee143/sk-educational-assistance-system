<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds application periods at a scale closer to SK's real ~2,000-3,000
 * applicants per cycle, specifically to test whether the Wilson
 * confidence interval (budgetForecast()) behaves sensibly at realistic
 * volume, and to sanity-check seeder performance before committing to
 * full-scale demo data. Deliberately separate from DemoDataSeeder,
 * which is tuned for report variety (reasons, claiming outcomes, minor/
 * adult mix) rather than raw volume.
 *
 * Change $applicantsPerPeriod below to test different scales (500, 1000,
 * 2000, etc.) without touching DemoDataSeeder.
 */
class BudgetScaleTestSeeder extends Seeder
{
    private int $applicantsPerPeriod = 500; // adjust this to test different scales

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

        $periods = [
            ['school_year' => '2023-2024', 'yearsAgo' => 3, 'passRate' => 0.75],
            ['school_year' => '2024-2025', 'yearsAgo' => 2, 'passRate' => 0.82],
            ['school_year' => '2025-2026', 'yearsAgo' => 1, 'passRate' => 0.88],
        ];

        $start = microtime(true);

        foreach ($periods as $p) {
            $total = $this->applicantsPerPeriod;
            $approved = (int) round($total * $p['passRate']);

            $config = ApplicationConfiguration::create([
                'school_year'  => $p['school_year'],
                'open_date'    => now()->subYears($p['yearsAgo'])->setMonth(7)->setDay(1)->startOfDay(),
                'close_date'   => now()->subYears($p['yearsAgo'])->setMonth(7)->setDay(31)->endOfDay(),
                'slot_limit'   => $total + 500,
                'slots_filled' => $approved,
                'is_unlimited' => false,
                'is_active'    => false,
                'created_by'   => $admin->id,
            ]);

            $this->seedFlatApplications($config, $total, $approved);

            $elapsed = round(microtime(true) - $start, 1);
            $this->command->info("Seeded {$p['school_year']}: {$total} applicants ({$approved} approved). Elapsed: {$elapsed}s");
        }

        $totalElapsed = round(microtime(true) - $start, 1);
        $this->command->info("Done. Total time: {$totalElapsed}s for " . (count($periods) * $this->applicantsPerPeriod) . " applicants across " . count($periods) . " periods.");
    }

    /**
     * Minimal, fast seeding — no VerifierAction, no ClaimingAssignment,
     * no minor/adult variety. Just enough for budgetForecast()'s Wilson
     * calculation to have real total/approved counts to work with.
     */
    private function seedFlatApplications(ApplicationConfiguration $config, int $total, int $approved): void
    {
        static $counter = 0;

        for ($i = 0; $i < $total; $i++) {
            $counter++;
            $status = $i < $approved ? 'approved' : 'rejected';

            $user = User::create([
                'first_name'        => 'Scale',
                'middle_name'       => 'Test',
                'last_name'         => 'User' . $counter,
                'email'             => "scaletest{$counter}@test.com",
                'mobile_number'     => '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT),
                'password'          => Hash::make('applicant123'),
                'role'              => 'applicant',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]);

            StudentProfile::create([
                'user_id'             => $user->id,
                'birthdate'           => now()->subYears(rand(18, 24)),
                'barangay'            => 'Mamatid',
                'is_profile_complete' => true,
            ]);

            Application::create([
                'user_id'           => $user->id,
                'config_id'         => $config->id,
                'school_name'       => 'Pamantasan ng Cabuyao',
                'course'            => 'BS Information Technology',
                'year_level'        => '1st Year',
                'student_id_number' => "2026-{$counter}",
                'status'            => $status,
                'control_number'    => $status === 'approved' ? "SK-{$config->open_date->format('Y')}-" . str_pad($counter, 5, '0', STR_PAD_LEFT) : null,
                'submitted_at'      => $config->open_date->copy()->addDays(rand(0, 20)),
            ]);
        }
    }
}