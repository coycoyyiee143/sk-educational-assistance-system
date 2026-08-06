<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\VerifierAction;
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
        'Mapúa Malayan Colleges Laguna',
        'Colegio de San Juan de Letran Calamba',
    ];

    private array $courses = [
        'BS Information Technology',
        'BS Nursing',
        'BS Business Administration',
        'BS Education',
        'BS Criminology',
        'BS Accountancy',
        'BS Psychology',
    ];

    private array $yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

    private array $rejectionReasons = [
        'Name does not match other submitted documents.',
        'Not a registered voter in Barangay Mamatid.',
        'Voter\'s Certificate not issued within the current year.',
        'Applicant does not meet program eligibility requirements.',
    ];

    private array $reuploadReasonsByDoc = [
        'registration_form' => [
            'Image blurry or unreadable.',
            'Wrong school year (must be A.Y. current).',
        ],
        'school_id' => [
            'Image blurry or unreadable.',
            'File uploaded is not the correct document type.',
        ],
        'voters_certificate' => [
            'Image blurry or unreadable.',
            'Not a registered voter in Barangay Mamatid.',
        ],
    ];

    private array $notClearedReasons = [
        'Physical documents did not match submitted application.',
        'Document appeared altered or invalid.',
        'Registration Form not a certified true copy or missing dry seal.',
        'Applicant did not bring all required physical documents.',
    ];

    private ?User $verifier = null;

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

        $this->verifier = User::create([
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

        // ── Historical Period 3: 2025-2026, completed, higher approval rate,
        //    fully claimed so this period powers Claiming Outcome Summary ──
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
        $this->seedApplicationsForPeriod($config2025, total: 133, approvedCount: 118, submittedAround: now()->subYear()->setMonth(7), withClaiming: true);

        // ── Active Period: 2026-2027, currently open, mixed live statuses ──
        $configActive = ApplicationConfiguration::create([
            'school_year'  => '2026-2027',
            'open_date'    => now()->subDays(10)->startOfDay(),
            'close_date'   => now()->addDays(4)->endOfDay(),
            'slot_limit'   => 300,
            'slots_filled' => 0,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);
        $this->seedActivePeriodMix($configActive);

        $this->command->info('Demo data seeded: 3 completed periods (one with full claiming data) + 1 active period with realistic status distribution, profiles, and verifier reason data.');
    }

    private function seedApplicationsForPeriod(ApplicationConfiguration $config, int $total, int $approvedCount, $submittedAround, bool $withClaiming = false): void
    {
        $rejectedCount = (int) round(($total - $approvedCount) * 0.7);
        $staleCount    = $total - $approvedCount - $rejectedCount;

        $controlSeq = 1;
        $approvedApps = [];

        for ($i = 0; $i < $approvedCount; $i++) {
            $applicant = $this->makeApplicant();
            $app = Application::create([
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
            $approvedApps[] = $app;

            // Roughly a third of approvals came from a manual verifier
            // decision (rest were auto-approved, no VerifierAction) — this
            // powers the "System Approved" vs "Approved" distinction.
            if (rand(1, 3) === 1) {
                VerifierAction::create([
                    'application_id' => $app->id,
                    'verifier_id'    => $this->verifier->id,
                    'action'         => 'approved',
                    'notes'          => 'Looks good.',
                ]);
            }
        }

        for ($i = 0; $i < $rejectedCount; $i++) {
            $applicant = $this->makeApplicant();
            $reasonCategories = collect($this->rejectionReasons)->random(rand(1, 2))->values()->all();
            $app = Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '20' . rand(20, 26) . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'rejected',
                'rejection_reason'  => implode(' ', $reasonCategories),
                'submitted_at'      => $submittedAround->copy()->addDays(rand(0, 20)),
            ]);

            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $this->verifier->id,
                'action'            => 'rejected',
                'reason_categories' => $reasonCategories,
                'notes'             => implode(' ', $reasonCategories),
            ]);
        }

        for ($i = 0; $i < $staleCount; $i++) {
            $applicant = $this->makeApplicant();
            $app = Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '20' . rand(20, 26) . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'for_review',
                'submitted_at'      => $submittedAround->copy()->addDays(rand(0, 20)),
            ]);

            // About half of these were previously flagged for re-upload —
            // powers Document Failure Breakdown.
            if (rand(0, 1) === 1) {
                $docType = array_rand($this->reuploadReasonsByDoc);
                $reasonCategories = collect($this->reuploadReasonsByDoc[$docType])->random(rand(1, 2))->values()->all();

                VerifierAction::create([
                    'application_id'    => $app->id,
                    'verifier_id'       => $this->verifier->id,
                    'action'            => 'reupload_requested',
                    'notes'             => 'Please re-upload the following document(s): ' . ucwords(str_replace('_', ' ', $docType)) . '.',
                    'reupload_details'  => [[
                        'document_type'      => $docType,
                        'label'              => ucwords(str_replace('_', ' ', $docType)),
                        'reason_categories'  => $reasonCategories,
                        'reason'             => implode(' ', $reasonCategories),
                    ]],
                ]);
            }
        }

        if ($withClaiming && count($approvedApps) > 0) {
            $this->seedClaimingForApprovedApps($config, $approvedApps);
        }
    }

    private function seedClaimingForApprovedApps(ApplicationConfiguration $config, array $approvedApps): void
    {
        $schedule = ClaimingSchedule::create([
            'config_id'    => $config->id,
            'location'     => 'Barangay Mamatid Covered Court',
            'is_published' => true,
            'published_at' => $config->close_date->copy()->addDays(5),
        ]);

        $lane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => count($approvedApps) + 10,
            'batch'                => 'morning',
            'claiming_date'        => $config->close_date->copy()->addDays(10)->toDateString(),
        ]);

        foreach ($approvedApps as $app) {
            // Realistic-ish split: most claimed, some not cleared, some
            // never showed up, so Claiming Outcome Summary has variety.
            $roll = rand(1, 100);
            if ($roll <= 78) {
                $status = 'claimed';
                $reasonCategories = null;
            } elseif ($roll <= 92) {
                $status = 'not_cleared';
                $reasonCategories = collect($this->notClearedReasons)->random(rand(1, 2))->values()->all();
            } else {
                $status = 'unclaimed';
                $reasonCategories = null;
            }

            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => $status,
                'reason_categories'    => $reasonCategories,
                'verified_by'          => $this->verifier->id,
                'verified_at'          => $lane->claiming_date,
            ]);

            $app->update(['status' => $status]);
        }
    }

    private function seedActivePeriodMix(ApplicationConfiguration $config): void
    {
        $mix = [
            'approved'             => 40,
            'for_review'           => 15,
            'pending_prescreening' => 12,
            'reupload_requested'   => 8,
            'rejected'             => 10,
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
                    $reasonCategories = collect($this->rejectionReasons)->random(rand(1, 2))->values()->all();
                    $data['rejection_reason'] = implode(' ', $reasonCategories);
                }

                $app = Application::create($data);

                if ($status === 'approved' && rand(1, 3) === 1) {
                    VerifierAction::create([
                        'application_id' => $app->id,
                        'verifier_id'    => $this->verifier->id,
                        'action'         => 'approved',
                        'notes'          => 'Looks good.',
                    ]);
                }

                if ($status === 'rejected') {
                    VerifierAction::create([
                        'application_id'    => $app->id,
                        'verifier_id'       => $this->verifier->id,
                        'action'            => 'rejected',
                        'reason_categories' => explode(' ', $data['rejection_reason']) ? [$data['rejection_reason']] : [],
                        'notes'             => $data['rejection_reason'],
                    ]);
                }

                if ($status === 'reupload_requested') {
                    $docType = array_rand($this->reuploadReasonsByDoc);
                    $reasonCategories = collect($this->reuploadReasonsByDoc[$docType])->random(rand(1, 2))->values()->all();

                    VerifierAction::create([
                        'application_id'    => $app->id,
                        'verifier_id'       => $this->verifier->id,
                        'action'            => 'reupload_requested',
                        'notes'             => 'Please re-upload the following document(s): ' . ucwords(str_replace('_', ' ', $docType)) . '.',
                        'reupload_details'  => [[
                            'document_type'      => $docType,
                            'label'              => ucwords(str_replace('_', ' ', $docType)),
                            'reason_categories'  => $reasonCategories,
                            'reason'             => implode(' ', $reasonCategories),
                        ]],
                    ]);
                }
            }
        }

        $config->update(['slots_filled' => $mix['approved']]);
    }

    private function makeApplicant(): User
    {
        static $counter = 0;
        $counter++;

        $user = User::create([
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

        // Roughly 15% minors, rest adults — gives Age Distribution report
        // real variety instead of an all-adult population.
        $isMinor = rand(1, 100) <= 15;

        $profileData = [
            'user_id'             => $user->id,
            'barangay'            => 'Mamatid',
            'is_profile_complete' => true,
        ];

        if ($isMinor) {
            $profileData['birthdate']             = now()->subYears(rand(15, 17))->subDays(rand(0, 364));
            $profileData['guardian_first_name']    = 'Guardian';
            $profileData['guardian_middle_name']   = 'M';
            $profileData['guardian_last_name']     = "Of{$user->last_name}";
            $profileData['guardian_relationship']  = collect(['Mother', 'Father', 'Guardian'])->random();
            $profileData['guardian_contact']       = '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT);
        } else {
            $profileData['birthdate'] = now()->subYears(rand(18, 24))->subDays(rand(0, 364));
        }

        StudentProfile::create($profileData);

        return $user;
    }
}