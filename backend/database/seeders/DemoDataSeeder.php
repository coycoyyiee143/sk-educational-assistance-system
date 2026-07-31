<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DemoDataSeeder extends Seeder
{
    private array $schools = [
        'Pamantasan ng Cabuyao',
        'St. Vincent College of Cabuyao',
        'STI College Calamba',
        'University of Perpetual Help System DALTA Calamba',
        'Laguna State Polytechnic University',
    ];

    private array $courses = [
        'BS Information Technology',
        'BS Nursing',
        'BS Business Administration',
        'BS Education',
        'BS Criminology',
    ];

    private array $yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

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

        // ── Historical Period 1: 2023-2024, completed, lower approval rate ──
        $config2023 = ApplicationConfiguration::create([
            'school_year'  => '2023-2024',
            'open_date'    => now()->subYears(3)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYears(3)->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 100,
            'slots_filled' => 62,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedApplicationsForPeriod($config2023, total: 78, approvedCount: 62, submittedAround: now()->subYears(3)->setMonth(7));

        // ── Historical Period 2: 2024-2025, completed, mid approval rate ──
        $config2024 = ApplicationConfiguration::create([
            'school_year'  => '2024-2025',
            'open_date'    => now()->subYears(2)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYears(2)->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 120,
            'slots_filled' => 85,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedApplicationsForPeriod($config2024, total: 101, approvedCount: 85, submittedAround: now()->subYears(2)->setMonth(7));

        // ── Historical Period 3: 2025-2026, completed, higher approval rate ──
        $config2025 = ApplicationConfiguration::create([
            'school_year'  => '2025-2026',
            'open_date'    => now()->subYear()->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYear()->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 150,
            'slots_filled' => 118,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedApplicationsForPeriod($config2025, total: 133, approvedCount: 118, submittedAround: now()->subYear()->setMonth(7));

        // ── Active Period: 2026-2027, currently open, mixed live statuses ──
        $configActive = ApplicationConfiguration::create([
            'school_year'  => '2026-2027',
            'open_date'    => now()->subDays(10)->startOfDay(),
            'close_date'   => now()->addDays(4)->endOfDay(),
            'slot_limit'   => 150,
            'slots_filled' => 0,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);
        $this->seedActivePeriodMix($configActive);

        $this->command->info('Demo data seeded: 3 completed periods + 1 active period with realistic status distribution.');
    }

    private function seedApplicationsForPeriod(ApplicationConfiguration $config, int $total, int $approvedCount, $submittedAround): void
    {
        $rejectedCount = (int) round(($total - $approvedCount) * 0.7);
        $staleCount    = $total - $approvedCount - $rejectedCount;

        $controlSeq = 1;

        for ($i = 0; $i < $approvedCount; $i++) {
            $applicant = $this->makeApplicant();
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '20' . rand(20, 26) . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'approved',
                'control_number'    => 'SK-' . $config->open_date->format('Y') . '-' . str_pad($controlSeq++, 4, '0', STR_PAD_LEFT),
                'submitted_at'      => $submittedAround->copy()->addDays(rand(0, 20)),
            ]);
        }

        for ($i = 0; $i < $rejectedCount; $i++) {
            $applicant = $this->makeApplicant();
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '20' . rand(20, 26) . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'rejected',
                'rejection_reason'  => 'Document verification failed — mismatched applicant details.',
                'submitted_at'      => $submittedAround->copy()->addDays(rand(0, 20)),
            ]);
        }

        for ($i = 0; $i < $staleCount; $i++) {
            $applicant = $this->makeApplicant();
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '20' . rand(20, 26) . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'for_review',
                'submitted_at'      => $submittedAround->copy()->addDays(rand(0, 20)),
            ]);
        }
    }

    private function seedActivePeriodMix(ApplicationConfiguration $config): void
    {
        $mix = [
            'approved'             => 22,
            'for_review'           => 9,
            'pending_prescreening' => 6,
            'reupload_requested'   => 3,
            'rejected'             => 4,
        ];

        $controlSeq = 1;
        $daysAgo = 10;

        foreach ($mix as $status => $count) {
            for ($i = 0; $i < $count; $i++) {
                $applicant = $this->makeApplicant();

                $data = [
                    'user_id'           => $applicant->id,
                    'config_id'         => $config->id,
                    'school_name'       => $this->schools[array_rand($this->schools)],
                    'course'            => $this->courses[array_rand($this->courses)],
                    'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                    'student_id_number' => '2026-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                    'status'            => $status,
                    'submitted_at'      => now()->subDays(rand(0, $daysAgo)),
                ];

                if ($status === 'approved') {
                    $data['control_number'] = 'SK-' . now()->format('Y') . '-' . str_pad($controlSeq++, 4, '0', STR_PAD_LEFT);
                }
                if ($status === 'rejected') {
                    $data['rejection_reason'] = 'Voter\'s certificate does not match declared barangay.';
                }

                Application::create($data);
            }
        }

        $config->update(['slots_filled' => $mix['approved']]);
    }

    private function makeApplicant(): User
    {
        static $counter = 0;
        $counter++;

        return User::create([
            'first_name'        => 'Demo',
            'middle_name'       => 'Applicant',
            'last_name'         => 'User' . $counter,
            'email'             => "demo.applicant{$counter}@test.com",
            'mobile_number'     => '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT),
            'password'          => Hash::make('applicant123'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);
    }
}