<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Dedicated demo seeder for the four Budget Planning tools.
 *
 * The story, made explicit:
 *   2022-2023 through 2024-2025 — demand roughly tracks slots, low/no
 *   unmet demand. Establishes a normal baseline.
 *
 *   2025-2026 — the SPIKE. Slots fully claimed AND a real, sizeable
 *   waitlist that never got in (unmet demand ratio jumps sharply
 *   compared to every prior year). THIS is the evidence that justifies
 *   the decision below — not a vague "demand grew," a specific,
 *   visible number.
 *
 *   2026-2027 (ACTIVE) — SK's actual response: slots increased
 *   directly because of 2025-2026's spike. Unmet demand ratio drops
 *   but doesn't hit zero — proof the expansion helped without
 *   overcorrecting into unlimited slots.
 *
 * What each tool demonstrates once seeded:
 *   - Budget Allocation Planning: usable immediately, pre-fills from
 *     the most recent COMPLETED period (2025-2026).
 *   - Budget Analysis: 5 real rows, rising utilization, visible
 *     disbursement jump into 2026-2027.
 *   - Unmet Demand Tracker: flat/near-zero for 3 years, a sharp spike
 *     at 2025-2026, a smaller-but-real ratio at 2026-2027 — the
 *     actual justification for the slot increase, made visible.
 *   - Budget Forecast: pools the 4 completed periods into a real
 *     Wilson interval — demonstrates the honestly-disclosed
 *     "too few periods for a decision-ready range" limitation.
 */
class BudgetToolsDemoSeeder extends Seeder
{
    public function run(): void
    {
        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

        $admin = User::firstOrCreate(
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

        $sharedPasswordHash = Hash::make('applicant123');

        $periods = [
            ['yearsAgo' => 4, 'school_year' => '2022-2023', 'slots' => 900,  'approved' => 850,  'rejected' => 60, 'unmet' => 10,  'closed' => true],
            ['yearsAgo' => 3, 'school_year' => '2023-2024', 'slots' => 1000, 'approved' => 950,  'rejected' => 60, 'unmet' => 15,  'closed' => true],
            ['yearsAgo' => 2, 'school_year' => '2024-2025', 'slots' => 1100, 'approved' => 1050, 'rejected' => 70, 'unmet' => 20,  'closed' => true],
            // THE SPIKE — this is the number the dean actually needs to see.
            ['yearsAgo' => 1, 'school_year' => '2025-2026', 'slots' => 1100, 'approved' => 1100, 'rejected' => 80, 'unmet' => 320, 'closed' => true],
            // SK's response — slots jump 1100 -> 1650, directly because of the spike above.
            ['yearsAgo' => 0, 'school_year' => '2026-2027', 'slots' => 1650, 'approved' => 1500, 'rejected' => 90, 'unmet' => 110, 'closed' => false],
        ];

        $start = microtime(true);
        $counter = 0;

        foreach ($periods as $p) {
            $isActive = !$p['closed'];

            if ($isActive) {
                $openDate  = now()->subDays(30);
                $closeDate = now()->addDays(15);
            } else {
                $openDate  = now()->subYears($p['yearsAgo'])->setMonth(7)->setDay(1)->startOfDay();
                $closeDate = now()->subYears($p['yearsAgo'])->setMonth(7)->setDay(31)->endOfDay();
            }

            $config = ApplicationConfiguration::create([
                'school_year'       => $p['school_year'],
                'open_date'         => $openDate,
                'close_date'        => $closeDate,
                'slot_limit'        => $p['slots'],
                'slots_filled'      => $p['approved'],
                'assistance_amount' => 2000,
                'is_unlimited'      => false,
                'is_active'         => $isActive,
                'created_by'        => $admin->id,
            ]);

            $unmetStatus = $p['closed'] ? 'not_selected' : 'waitlisted';

            $counter = $this->seedBatch($config, $counter, $p['approved'], 'approved', $sharedPasswordHash);
            $counter = $this->seedBatch($config, $counter, $p['rejected'], 'rejected', $sharedPasswordHash);
            $counter = $this->seedBatch($config, $counter, $p['unmet'], $unmetStatus, $sharedPasswordHash);

            $total = $p['approved'] + $p['rejected'] + $p['unmet'];
            $ratio = $p['approved'] > 0 ? round(($p['unmet'] / $p['approved']) * 100, 1) : 0;
            $elapsed = round(microtime(true) - $start, 1);
            $this->command->info("Seeded {$p['school_year']}: {$total} submitted, {$p['approved']} approved, unmet demand ratio {$ratio}%. Elapsed: {$elapsed}s");
        }

        $totalElapsed = round(microtime(true) - $start, 1);
        $this->command->info("Done in {$totalElapsed}s. Log in as admin@skmamatid.com / admin123 and visit Admin > Budget Planning.");
    }

    private function seedBatch(ApplicationConfiguration $config, int $counter, int $count, string $status, string $passwordHash): int
    {
        for ($i = 0; $i < $count; $i++) {
            $counter++;

            $user = User::create([
                'first_name'        => 'Budget',
                'middle_name'       => 'Demo',
                'last_name'         => 'User' . $counter,
                'email'             => "budgetdemo{$counter}@test.com",
                'mobile_number'     => '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT),
                'password'          => $passwordHash,
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

            $isUnmet = in_array($status, ['waitlisted', 'not_selected']);

            Application::create([
                'user_id'           => $user->id,
                'config_id'         => $config->id,
                'school_name'       => 'Pamantasan ng Cabuyao',
                'course'            => 'BS Information Technology',
                'year_level'        => '1st Year',
                'student_id_number' => "2026-{$counter}",
                'status'            => $status,
                'control_number'    => $status === 'approved' ? "SK-{$config->school_year}-" . str_pad($counter, 5, '0', STR_PAD_LEFT) : null,
                'submitted_at'      => $config->open_date->copy()->addDays(rand(0, 20)),
                'waitlisted_at'     => $isUnmet ? $config->open_date->copy()->addDays(rand(15, 25)) : null,
            ]);
        }
        return $counter;
    }
}