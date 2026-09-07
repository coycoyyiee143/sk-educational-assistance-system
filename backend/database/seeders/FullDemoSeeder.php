<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\VerifierAction;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class FullDemoSeeder extends Seeder
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

    private ?User $verifier = null;
    private int $assistanceAmount = 2000;
    private string $sharedPasswordHash;

    public function run(): void
    {
        $this->sharedPasswordHash = Hash::make('applicant123');

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

        // ── Closed periods: claiming genuinely already happened, fully
        //    resolved, 100% claimed — "Applicants Funded" reads exactly
        //    slot_limit every time. Feeds Budget Analysis + the Unmet
        //    Demand trend line with clean historical data. ──
        $config2022 = $this->createClosedConfig('2022-2023', 4, 200, $admin);
        $this->seedHistoricalPeriod($config2022, approvedCount: 200, rejectedCount: 15, unmetCount: 2);

        $config2023 = $this->createClosedConfig('2023-2024', 3, 200, $admin);
        $this->seedHistoricalPeriod($config2023, approvedCount: 200, rejectedCount: 18, unmetCount: 5);

        $config2024 = $this->createClosedConfig('2024-2025', 2, 200, $admin);
        $this->seedHistoricalPeriod($config2024, approvedCount: 200, rejectedCount: 20, unmetCount: 52);

        $config2025 = $this->createClosedConfig('2025-2026', 1, 200, $admin);
        $this->seedHistoricalPeriod($config2025, approvedCount: 200, rejectedCount: 22, unmetCount: 64);

        // ── 2026-2027: applications just closed, claiming is IN
        //    PROGRESS — is_active stays true (real system behavior;
        //    closePeriod() is a manual admin action, not automatic once
        //    close_date passes). Real, unresolved claiming data exists
        //    here specifically so this period can be demoed LIVE —
        //    click a claim, mark not_cleared, watch a promotion happen.
        //    Nothing is resolved yet, so Application.status stays
        //    'approved' throughout and "Applicants Funded" reads exactly
        //    250, matching slot_limit. ──
        $configActive = ApplicationConfiguration::create([
            'school_year'       => '2026-2027',
            'open_date'         => now()->subDays(45)->startOfDay(),
            'close_date'        => now()->subDays(2)->endOfDay(),
            'slot_limit'        => 250,
            'slots_filled'      => 250,
            'assistance_amount' => $this->assistanceAmount,
            'is_unlimited'      => false,
            'is_active'         => true,
            'created_by'        => $admin->id,
        ]);
        $this->seedApprovedApplicants($configActive, 250);
        $this->seedMixedStatusApplications($configActive);
        $this->seedWaitlistedApplicants($configActive, 50);

        $schedule = $this->seedClaimingSchedule($configActive);
        $this->seedPendingClaimingAssignments($configActive, $schedule);
        $this->seedOnePromotedApplicant($configActive, $schedule);

        $this->command->info('FullDemoSeeder complete: 4 closed periods (2022-2026, flat 200 slots, fully claimed, real waitlist data) + 1 active period (2026-2027, 250 slots, 50 waitlisted, claiming schedule published with real UNRESOLVED assignments ready to demo live, one pre-promoted applicant). Log in as admin@skmamatid.com / admin123, verifier@skmamatid.com / verifier123.');
    }

    private function createClosedConfig(string $schoolYear, int $yearsAgo, int $slots, User $admin): ApplicationConfiguration
    {
        return ApplicationConfiguration::create([
            'school_year'       => $schoolYear,
            'open_date'         => now()->subYears($yearsAgo)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'        => now()->subYears($yearsAgo)->setMonth(7)->setDay(31)->endOfDay(),
            'closed_at'         => now()->subYears($yearsAgo)->setMonth(8)->setDay(5)->endOfDay(),
            'slot_limit'        => $slots,
            'slots_filled'      => $slots,
            'assistance_amount' => $this->assistanceAmount,
            'is_unlimited'      => false,
            'is_active'         => false,
            'created_by'        => $admin->id,
        ]);
    }

    private function seedHistoricalPeriod(ApplicationConfiguration $config, int $approvedCount, int $rejectedCount, int $unmetCount): void
    {
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
                'submitted_at'      => $config->open_date->copy()->addDays(rand(0, 20)),
            ]);
            $approvedApps[] = $app;

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
                'submitted_at'      => $config->open_date->copy()->addDays(rand(0, 20)),
            ]);
            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $this->verifier->id,
                'action'            => 'rejected',
                'reason_categories' => $reasonCategories,
                'notes'             => implode(' ', $reasonCategories),
            ]);
        }

        for ($i = 0; $i < $unmetCount; $i++) {
            $applicant = $this->makeApplicant();
            $waitlistedAt = $config->open_date->copy()->addDays(rand(15, 25));
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '20' . rand(20, 26) . '-' . str_pad(rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'waitlisted',
                'waitlisted_at'     => $waitlistedAt,
                'submitted_at'      => $waitlistedAt->copy()->subDays(rand(1, 10)),
            ]);
        }

        if (count($approvedApps) > 0) {
            $this->seedFullyClaimedHistory($config, $approvedApps);
        }
    }

    private function seedFullyClaimedHistory(ApplicationConfiguration $config, array $approvedApps): void
    {
        $laneDate = $config->close_date->copy()->addDays(10);

        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_active'             => true,
            'activated_at'          => $config->close_date->copy()->addDays(5),
            'grace_period_date'     => $laneDate->copy()->addDays(3)->toDateString(),
            'grace_period_end_date' => $laneDate->copy()->addDays(8)->toDateString(),
        ]);

        $lane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => count($approvedApps) + 10,
            'batch'                => 'morning',
            'claiming_date'        => $laneDate->toDateString(),
        ]);

        foreach ($approvedApps as $app) {
            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => 'claimed',
                'amount'               => $this->assistanceAmount,
                'source'               => 'original',
                'verified_by'          => $this->verifier->id,
                'verified_at'          => $lane->claiming_date,
            ]);
            $app->update(['status' => 'claimed']);
        }
    }

    private function seedApprovedApplicants(ApplicationConfiguration $config, int $count): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $applicant = $this->makeApplicant();
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '2026-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'status'            => 'approved',
                'control_number'    => 'SK-' . now()->format('Y') . '-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'submitted_at'      => now()->subDays(rand(30, 44)),
            ]);
        }
    }

    private function seedMixedStatusApplications(ApplicationConfiguration $config): void
    {
        $mix = [
            'for_review'           => 12,
            'pending_prescreening' => 8,
            'reupload_requested'   => 6,
            'rejected'             => 9,
        ];

        foreach ($mix as $status => $count) {
            for ($i = 0; $i < $count; $i++) {
                $applicant = $this->makeApplicant();
                $data = [
                    'user_id'           => $applicant->id,
                    'config_id'         => $config->id,
                    'school_name'       => $this->schools[array_rand($this->schools)],
                    'course'            => $this->courses[array_rand($this->courses)],
                    'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                    'student_id_number' => '2026-M' . str_pad((string) rand(1, 9999), 4, '0', STR_PAD_LEFT),
                    'status'            => $status,
                    'submitted_at'      => now()->subDays(rand(10, 40)),
                ];
                if ($status === 'rejected') {
                    $reasonCategories = collect($this->rejectionReasons)->random(rand(1, 2))->values()->all();
                    $data['rejection_reason'] = implode(' ', $reasonCategories);
                }
                $app = Application::create($data);

                if ($status === 'rejected') {
                    VerifierAction::create([
                        'application_id'    => $app->id,
                        'verifier_id'       => $this->verifier->id,
                        'action'            => 'rejected',
                        'reason_categories' => [$data['rejection_reason']],
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
    }

    private function seedWaitlistedApplicants(ApplicationConfiguration $config, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $applicant = $this->makeApplicant();
            $waitlistedAt = now()->subDays(rand(1, 10));
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '2026-W' . str_pad((string) rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'waitlisted',
                'waitlisted_at'     => $waitlistedAt,
                'submitted_at'      => $waitlistedAt->copy()->subDays(rand(1, 5)),
            ]);
        }
    }

    /**
     * Grace period is deliberately set to START TODAY / already open —
     * so both Regular Claiming AND Grace Period Claiming can be
     * demonstrated live on the same day you're presenting.
     */
    private function seedClaimingSchedule(ApplicationConfiguration $config): ClaimingSchedule
    {
        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_active'             => true,
            'activated_at'          => now()->subDays(1),
            'grace_period_date'     => now()->toDateString(),
            'grace_period_end_date' => now()->addDays(4)->toDateString(),
        ]);

        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 90,
            'batch'                => 'morning',
            'claiming_date'        => now()->toDateString(),
        ]);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane B',
            'capacity'             => 90,
            'batch'                => 'afternoon',
            'claiming_date'        => now()->toDateString(),
        ]);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane C',
            'capacity'             => 70,
            'batch'                => 'morning',
            'claiming_date'        => now()->toDateString(),
        ]);

        return $schedule;
    }

    /**
     * Every approved applicant assigned to a lane, all left UNRESOLVED
     * (pending_claiming) — this is the actual live-demo material. Since
     * nothing is resolved, Application.status stays 'approved' for all
     * 250, so "Applicants Funded" correctly reads 250, not less.
     */
    private function seedPendingClaimingAssignments(ApplicationConfiguration $config, ClaimingSchedule $schedule): void
    {
        $lanes = $schedule->lanes()->where('lane_name', '!=', 'Grace Period Claiming')->orderBy('id')->get();
        $remaining = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->orderBy('control_number')
            ->get()
            ->values();

        foreach ($lanes as $lane) {
            $chunk = $remaining->splice(0, $lane->capacity);
            foreach ($chunk as $app) {
                ClaimingAssignment::create([
                    'application_id'       => $app->id,
                    'claiming_schedule_id' => $schedule->id,
                    'claiming_lane_id'     => $lane->id,
                    'claim_status'         => 'pending_claiming',
                    'source'               => 'original',
                ]);
            }
        }

        if ($remaining->count() > 0) {
            $lastLane = $lanes->last();
            foreach ($remaining as $app) {
                ClaimingAssignment::create([
                    'application_id'       => $app->id,
                    'claiming_schedule_id' => $schedule->id,
                    'claiming_lane_id'     => $lastLane->id,
                    'claim_status'         => 'pending_claiming',
                    'source'               => 'original',
                ]);
            }
        }
    }

    /**
     * One applicant, seeded directly at grace-period status, so the
     * Grace Period Claiming List / promotion UI has real material to
     * show without needing a live promotion click first.
     */
    private function seedOnePromotedApplicant(ApplicationConfiguration $config, ClaimingSchedule $schedule): void
    {
        $applicant = $this->makeApplicant();
        $nextSeq = Application::where('config_id', $config->id)->whereNotNull('control_number')->count() + 1;

        $app = Application::create([
            'user_id'           => $applicant->id,
            'config_id'         => $config->id,
            'school_name'       => $this->schools[array_rand($this->schools)],
            'course'            => $this->courses[array_rand($this->courses)],
            'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
            'student_id_number' => '2026-P0001',
            'status'            => 'approved',
            'control_number'    => 'SK-' . now()->format('Y') . '-' . str_pad($nextSeq, 4, '0', STR_PAD_LEFT),
            'submitted_at'      => now()->subDays(20),
            'waitlisted_at'     => now()->subDays(20),
        ]);

        $config->increment('slots_filled');

        $lane = ClaimingLane::firstOrCreate(
            [
                'claiming_schedule_id' => $schedule->id,
                'lane_name'            => 'Grace Period Claiming',
            ],
            [
                'batch'         => 'morning',
                'claiming_date' => $schedule->grace_period_date,
                'capacity'      => null,
            ]
        );

        ClaimingAssignment::create([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
            'source'               => 'waitlist_promotion',
            'verified_by'          => $this->verifier->id,
            'verified_at'          => now()->subDays(1),
        ]);
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
            'password'          => $this->sharedPasswordHash,
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        $isMinor = rand(1, 100) <= 15;

        $profileData = [
            'user_id'             => $user->id,
            'barangay'            => 'Mamatid',
            'is_profile_complete' => true,
        ];

        if ($isMinor) {
            $profileData['birthdate']            = now()->subYears(rand(15, 17))->subDays(rand(0, 364));
            $profileData['guardian_first_name']   = 'Guardian';
            $profileData['guardian_middle_name']  = 'M';
            $profileData['guardian_last_name']    = "Of{$user->last_name}";
            $profileData['guardian_relationship'] = collect(['Mother', 'Father', 'Guardian'])->random();
            $profileData['guardian_contact']      = '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT);
        } else {
            $profileData['birthdate'] = now()->subYears(rand(18, 24))->subDays(rand(0, 364));
        }

        StudentProfile::create($profileData);

        return $user;
    }
}