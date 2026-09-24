<?php

namespace Database\Seeders;

use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Single, consolidated demo seeder for all four Budget Planning tools
 * (Budget Allocation Planning, Budget Analysis, Unmet Demand Tracker,
 * Budget Forecast). Replaces the old BudgetToolsDemoSeeder and
 * BudgetScaleTestSeeder — this is the one to run for that page.
 *
 * The story:
 *   2021-2022 through 2024-2025 — steady growth, demand roughly tracks
 *   slots, low unmet demand. A normal baseline.
 *
 *   2025-2026 — a demand SPIKE. Slots fully claimed and a real,
 *   sizeable unmet-demand ratio (~36%) that dwarfs every prior year.
 *
 *   2026-2027 (ACTIVE) — SK's response: slots raised from 450 to 650
 *   directly because of the 2025-2026 spike. Unmet demand drops but
 *   doesn't hit zero, showing the expansion helped without
 *   overcorrecting into unlimited slots.
 *
 * Volume is large enough per period (300-650 submissions) that pooling
 * all 5 completed periods gives Budget Forecast's Wilson interval a
 * realistically tight range (~ +/-1.5 points) instead of the
 * uselessly wide range you get from a couple dozen rows.
 *
 * Uses raw bulk inserts (not Eloquent::create per row) so ~3,000 rows
 * seed in a couple of seconds instead of a couple of minutes.
 *
 * Run standalone after a fresh migrate — do not stack with
 * DemoDataSeeder, which seeds its own overlapping school years:
 *   php artisan migrate:fresh
 *   php artisan db:seed --class=OpeningDaySeeder
 *   php artisan db:seed --class=BudgetForecastDemoSeeder
 */
class BudgetForecastDemoSeeder extends Seeder
{
    private int $counter = 0;

    public function run(): void
    {
        $admin = User::where('email', 'admin@skmamatid.com')->first();
        if (!$admin) {
            $this->command->error('Run OpeningDaySeeder first — it creates the admin account this seeder builds on top of.');
            return;
        }

        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

        $passwordHash = Hash::make('applicant123');

        $periods = [
            ['yearsAgo' => 4, 'school_year' => '2021-2022', 'slots' => 300, 'approved' => 300, 'rejected' => 15, 'unmet' => 5,   'amount' => 1500, 'closed' => true],
            ['yearsAgo' => 3, 'school_year' => '2022-2023', 'slots' => 350, 'approved' => 350, 'rejected' => 18, 'unmet' => 6,   'amount' => 1600, 'closed' => true],
            ['yearsAgo' => 2, 'school_year' => '2023-2024', 'slots' => 400, 'approved' => 400, 'rejected' => 20, 'unmet' => 8,   'amount' => 1800, 'closed' => true],
            ['yearsAgo' => 1, 'school_year' => '2024-2025', 'slots' => 450, 'approved' => 450, 'rejected' => 22, 'unmet' => 10,  'amount' => 2000, 'closed' => true],
            // THE SPIKE — this is the number that justifies the slot increase below.
            ['yearsAgo' => 0.4, 'school_year' => '2025-2026', 'slots' => 450, 'approved' => 450, 'rejected' => 40, 'unmet' => 160, 'amount' => 2000, 'closed' => true],
            // SK's response — slots jump 450 -> 650, directly because of the spike above.
            ['yearsAgo' => 0, 'school_year' => '2026-2027', 'slots' => 650, 'approved' => 580, 'rejected' => 35, 'unmet' => 45,  'amount' => 2000, 'closed' => false],
        ];

        $start = microtime(true);

        foreach ($periods as $p) {
            $isActive = !$p['closed'];

            if ($isActive) {
                $openDate  = now()->subDays(20);
                $closeDate = now()->addDays(25);
            } else {
                $openDate  = now()->copy()->subDays((int) round($p['yearsAgo'] * 365))->setDay(1)->startOfDay();
                $closeDate = $openDate->copy()->addDays(30)->endOfDay();
            }

            $config = ApplicationConfiguration::create([
                'school_year'       => $p['school_year'],
                'open_date'         => $openDate,
                'close_date'        => $closeDate,
                'slot_limit'        => $p['slots'],
                'slots_filled'      => $p['approved'],
                'assistance_amount' => $p['amount'],
                'is_unlimited'      => false,
                'is_active'         => $isActive,
                'created_by'        => $admin->id,
            ]);

            $unmetStatus = $p['closed'] ? 'not_selected' : 'waitlisted';

            $this->seedGroup($config, $p['approved'], 'approved', $passwordHash, $openDate);
            $this->seedGroup($config, $p['rejected'], 'rejected', $passwordHash, $openDate);
            $this->seedGroup($config, $p['unmet'], $unmetStatus, $passwordHash, $openDate);

            $total = $p['approved'] + $p['rejected'] + $p['unmet'];
            $ratio = $p['approved'] > 0 ? round(($p['unmet'] / $p['approved']) * 100, 1) : 0;
            $elapsed = round(microtime(true) - $start, 1);
            $this->command->info("Seeded {$p['school_year']}: {$total} submitted, {$p['approved']} approved, unmet demand ratio {$ratio}%. Elapsed: {$elapsed}s");
        }

        $totalElapsed = round(microtime(true) - $start, 1);
        $this->command->info("Done in {$totalElapsed}s. Log in as admin@skmamatid.com / admin123 and visit Admin > Budget Planning.");
    }

    /**
     * Bulk-inserts $count applicants (user + student_profile + application)
     * for the given status, in chunks, using the multi-row INSERT's
     * lastInsertId() to derive each row's user_id instead of one
     * Eloquent::create() round trip per row.
     */
    private function seedGroup(ApplicationConfiguration $config, int $count, string $status, string $passwordHash, $submittedBase): void
    {
        if ($count <= 0) {
            return;
        }

        $chunkSize = 500;
        $remaining = $count;

        while ($remaining > 0) {
            $batch = min($chunkSize, $remaining);
            $now = now();
            $startCounter = $this->counter + 1;

            $users = [];
            for ($i = 0; $i < $batch; $i++) {
                $this->counter++;
                $users[] = [
                    'first_name'        => 'Budget',
                    'middle_name'       => 'Demo',
                    'last_name'         => 'User' . $this->counter,
                    'email'             => "budgetdemo{$this->counter}@test.com",
                    'mobile_number'     => '09' . str_pad((string) $this->counter, 9, '0', STR_PAD_LEFT),
                    'password'          => $passwordHash,
                    'role'              => 'applicant',
                    'is_active'         => true,
                    'email_verified_at' => $now,
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ];
            }
            DB::table('users')->insert($users);
            $firstUserId = (int) DB::getPdo()->lastInsertId();

            $profiles = [];
            $applications = [];
            $isUnmet = in_array($status, ['waitlisted', 'not_selected']);

            for ($i = 0; $i < $batch; $i++) {
                $userId = $firstUserId + $i;
                $seq = $startCounter + $i;
                $isMinor = rand(1, 100) <= 15;

                $profiles[] = [
                    'user_id'             => $userId,
                    'birthdate'           => $isMinor
                        ? now()->subYears(rand(15, 17))
                        : now()->subYears(rand(18, 24)),
                    'barangay'            => 'Mamatid',
                    'is_profile_complete' => true,
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ];

                $applications[] = [
                    'user_id'           => $userId,
                    'config_id'         => $config->id,
                    'school_name'       => 'Pamantasan ng Cabuyao',
                    'course'            => 'BS Information Technology',
                    'year_level'        => '1st Year',
                    'student_id_number' => "2026-{$seq}",
                    'status'            => $status,
                    'control_number'    => $status === 'approved' ? "SK-{$config->school_year}-" . str_pad($seq, 5, '0', STR_PAD_LEFT) : null,
                    'submitted_at'      => $submittedBase->copy()->addDays(rand(0, 20)),
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ];
            }

            DB::table('student_profiles')->insert($profiles);
            DB::table('applications')->insert($applications);

            $remaining -= $batch;
        }
    }
}
