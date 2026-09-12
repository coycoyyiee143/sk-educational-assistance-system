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

/**
 * Main/default seeder — one comprehensive scenario meant to replace
 * reaching for a specific narrow scenario seeder every time. Covers:
 * every application status, two DIFFERENTLY-NAMED verifiers (so
 * "Reviewed By" on Applicant Records and "Disbursed By" on the
 * Disbursement Report visibly attribute to different people instead
 * of always showing the same name), a full claiming cycle, and one
 * closed historical period so trend/budget reports aren't empty.
 */
class MainSeeder extends Seeder
{
    private array $schools = [
        'Pamantasan ng Cabuyao',
        'St. Vincent College of Cabuyao',
        'STI College Calamba',
        'Laguna State Polytechnic University',
        'Mapúa Malayan Colleges Laguna',
    ];

    private array $courses = [
        'BS Information Technology',
        'BS Nursing',
        'BS Business Administration',
        'BS Accountancy',
        'BS Psychology',
    ];

    private array $yearLevels = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

    private array $rejectionReasons = [
        'Name does not match other submitted documents.',
        'Not a registered voter in Barangay Mamatid.',
        'Applicant does not meet program eligibility requirements.',
    ];

    private array $reuploadReasons = [
        'Image blurry or unreadable.',
        'Wrong school year (must be A.Y. current).',
    ];

    private array $notClearedReasons = [
        'Physical documents did not match submitted application.',
        'Unable to present valid ID during claiming.',
    ];

    // Real-looking, varied applicant names — cycled through by counter, so
    // the Record Preview search box (name / control number) has actual
    // distinct names to search against instead of "Demo Applicant User1".
    private array $firstNames = [
        'Juan', 'Maria', 'Jose', 'Ana', 'Pedro', 'Carmen', 'Antonio', 'Rosa',
        'Miguel', 'Elena', 'Carlos', 'Liza', 'Ramon', 'Grace', 'Ricardo', 'Nora',
        'Eduardo', 'Josefina', 'Manuel', 'Teresita', 'Roberto', 'Angelica', 'Fernando', 'Marites',
    ];

    private array $lastNames = [
        'Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Torres', 'Bautista', 'Ramos',
        'Villanueva', 'Fernandez', 'Gonzales', 'Aquino', 'Castro', 'Rivera', 'Flores', 'Salazar',
        'Domingo', 'Pascual', 'Manalo', 'Aguilar', 'Navarro', 'Cruz', 'Marquez', 'Roque',
    ];

    private User $admin;
    private User $verifierA;
    private User $verifierB;
    private string $applicantPasswordHash;
    private int $counter = 0;

    public function run(): void
    {
        $this->applicantPasswordHash = Hash::make('applicant123');

        $this->admin = User::firstOrCreate(
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

        // Two verifiers, on purpose, with distinct names — this is what
        // makes "Reviewed By" / "Disbursed By" actually mean something in
        // the reports, instead of one name repeated on every row.
        $this->verifierA = User::firstOrCreate(
            ['email' => 'verifier@skmamatid.com'],
            [
                'first_name'        => 'Jasmin',
                'middle_name'       => 'Reyes',
                'last_name'         => 'Cruz',
                'mobile_number'     => '09876543210',
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        $this->verifierB = User::firstOrCreate(
            ['email' => 'verifier2@skmamatid.com'],
            [
                'first_name'        => 'Miguel',
                'middle_name'       => 'Torres',
                'last_name'         => 'Bautista',
                'mobile_number'     => '09876543211',
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        $activeConfig = $this->seedActivePeriod();
        $this->seedHistoricalPeriod();

        $this->command->info('MainSeeder complete.');
        $this->command->info('Admin:      admin@skmamatid.com / admin123');
        $this->command->info('Verifier A: verifier@skmamatid.com / verifier123 (Jasmin Cruz)');
        $this->command->info('Verifier B: verifier2@skmamatid.com / verifier123 (Miguel Bautista)');
        $this->command->info('Active period: ' . $activeConfig->school_year . ' — every status represented, two verifiers alternating on reviews and claims.');
    }

    private function pickVerifier(int $i): User
    {
        return $i % 2 === 0 ? $this->verifierA : $this->verifierB;
    }

    private function seedActivePeriod(): ApplicationConfiguration
    {
        $config = ApplicationConfiguration::create([
            'school_year'       => '2026-2027',
            'open_date'         => now()->subDays(20)->startOfDay(),
            'close_date'        => now()->addDays(10)->endOfDay(),
            'slot_limit'        => 2000,
            'slots_filled'      => 0,
            'assistance_amount' => 5000,
            'is_unlimited'      => false,
            'is_active'         => true,
            'created_by'        => $this->admin->id,
        ]);

        // ── pending / in-progress statuses (no verifier decision yet) ──
        $this->seedPlainStatus($config, 'pending_prescreening', 6);
        $this->seedPlainStatus($config, 'for_review', 6);
        $this->seedWaitlisted($config, 4);

        // ── reupload_requested — reviewed by alternating verifiers ──
        for ($i = 0; $i < 5; $i++) {
            $app = $this->makeApplication($config, 'reupload_requested');
            $reasons = collect($this->reuploadReasons)->random(rand(1, 2))->values()->all();
            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $this->pickVerifier($i)->id,
                'action'            => 'reupload_requested',
                'notes'             => 'Please re-upload the flagged document(s).',
                'reupload_details'  => [[
                    'document_type'      => 'school_id',
                    'label'              => 'School ID',
                    'reason_categories'  => $reasons,
                    'reason'             => implode(' ', $reasons),
                ]],
            ]);
        }

        // ── rejected — reviewed by alternating verifiers ──
        for ($i = 0; $i < 6; $i++) {
            $reasons = collect($this->rejectionReasons)->random(rand(1, 2))->values()->all();
            $app = $this->makeApplication($config, 'rejected', [
                'rejection_reason' => implode(' ', $reasons),
            ]);
            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $this->pickVerifier($i)->id,
                'action'            => 'rejected',
                'reason_categories' => $reasons,
                'notes'             => implode(' ', $reasons),
            ]);
        }

        $approvedApps = [];
        $controlSeq = 1;

        // ── approved, AUTO — passed every automated check, system approved
        // it directly (see ProcessOcrDocument::updateApplicationStatus →
        // Application::tryApprove), no VerifierAction ever created. This is
        // what makes "Reviewed By" correctly show "System (Auto-Approved)"
        // instead of a blank dash.
        for ($i = 0; $i < 5; $i++) {
            $app = $this->makeApplication($config, 'approved', [
                'control_number' => 'SK-' . $config->open_date->format('Y') . '-AUTO' . str_pad($i + 1, 3, '0', STR_PAD_LEFT),
            ]);
            $approvedApps[] = $app;
            $config->increment('slots_filled');
        }

        // ── approved, MANUAL — reviewed by alternating verifiers, control numbers assigned ──
        for ($i = 0; $i < 14; $i++) {
            $app = $this->makeApplication($config, 'approved', [
                'control_number' => 'SK-' . $config->open_date->format('Y') . '-' . str_pad($controlSeq++, 4, '0', STR_PAD_LEFT),
            ]);
            VerifierAction::create([
                'application_id' => $app->id,
                'verifier_id'    => $this->pickVerifier($i)->id,
                'action'         => 'approved',
                'notes'          => 'Looks good.',
            ]);
            $approvedApps[] = $app;
            $config->increment('slots_filled');
        }

        $this->seedClaimingCycle($config, $approvedApps);

        return $config;
    }

    /**
     * Splits approved applicants into claimed / not_cleared / unclaimed,
     * with "Disbursed By" alternating between the two verifiers — same
     * purpose as the alternating review assignment above, but for the
     * claiming side of the report.
     */
    private function seedClaimingCycle(ApplicationConfiguration $config, array $approvedApps): void
    {
        $laneDate = now()->subDays(2);

        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_published'          => true,
            'published_at'          => now()->subDays(5),
            'grace_period_date'     => now()->addDays(1)->toDateString(),
            'grace_period_end_date' => now()->addDays(6)->toDateString(),
        ]);

        $lane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => count($approvedApps) + 5,
            'batch'                => 'morning',
            'claiming_date'        => $laneDate->toDateString(),
        ]);

        foreach ($approvedApps as $i => $app) {
            $roll = $i % 5;
            if ($roll < 3) {
                $status = 'claimed';
                $reasons = null;
            } elseif ($roll === 3) {
                $status = 'not_cleared';
                $reasons = collect($this->notClearedReasons)->random(1)->values()->all();
            } else {
                $status = 'unclaimed';
                $reasons = null;
            }

            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => $status,
                'amount'               => $config->assistance_amount,
                'source'               => 'original',
                'reason_categories'    => $reasons,
                'verified_by'          => $this->pickVerifier($i)->id,
                'verified_at'          => $laneDate,
            ]);

            $app->update(['status' => $status]);
        }
    }

    private function seedHistoricalPeriod(): void
    {
        $config = ApplicationConfiguration::create([
            'school_year'       => '2025-2026',
            'open_date'         => now()->subYear()->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'        => now()->subYear()->setMonth(7)->setDay(31)->endOfDay(),
            'closed_at'         => now()->subYear()->setMonth(8)->setDay(5)->endOfDay(),
            'slot_limit'        => 1500,
            'slots_filled'      => 20,
            'assistance_amount' => 4000,
            'is_unlimited'      => false,
            'is_active'         => false,
            'created_by'        => $this->admin->id,
        ]);

        $controlSeq = 1;
        for ($i = 0; $i < 20; $i++) {
            $this->makeApplication($config, 'claimed', [
                'control_number' => 'SK-' . $config->open_date->format('Y') . '-' . str_pad($controlSeq++, 4, '0', STR_PAD_LEFT),
                'submitted_at'   => $config->open_date->copy()->addDays(rand(0, 20)),
            ]);
        }
        for ($i = 0; $i < 6; $i++) {
            $reasons = collect($this->rejectionReasons)->random(1)->values()->all();
            $this->makeApplication($config, 'rejected', [
                'rejection_reason' => implode(' ', $reasons),
                'submitted_at'     => $config->open_date->copy()->addDays(rand(0, 20)),
            ]);
        }
    }

    private function seedPlainStatus(ApplicationConfiguration $config, string $status, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->makeApplication($config, $status);
        }
    }

    private function seedWaitlisted(ApplicationConfiguration $config, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $waitlistedAt = now()->subDays(rand(1, 10));
            $this->makeApplication($config, 'waitlisted', [
                'waitlisted_at' => $waitlistedAt,
                'submitted_at'  => $waitlistedAt->copy()->subDays(rand(1, 5)),
            ]);
        }
    }

    private function makeApplication(ApplicationConfiguration $config, string $status, array $overrides = []): Application
    {
        $applicant = $this->makeApplicant();

        return Application::create(array_merge([
            'user_id'           => $applicant->id,
            'config_id'         => $config->id,
            'school_name'       => $this->schools[array_rand($this->schools)],
            'course'            => $this->courses[array_rand($this->courses)],
            'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
            'student_id_number' => '20' . rand(20, 26) . '-' . str_pad((string) rand(1, 9999), 4, '0', STR_PAD_LEFT),
            'status'            => $status,
            'submitted_at'      => now()->subDays(rand(1, 15)),
        ], $overrides));
    }

    private function makeApplicant(): User
    {
        $this->counter++;

        // Cycle through the name pools so applicants get real-looking,
        // varied names instead of "Demo Applicant User1" — this is what
        // makes the Record Preview name search actually testable.
        $firstName = $this->firstNames[$this->counter % count($this->firstNames)];
        $lastName  = $this->lastNames[intdiv($this->counter, count($this->firstNames)) % count($this->lastNames)];

        $user = User::create([
            'first_name'        => $firstName,
            'middle_name'       => 'Santos',
            'last_name'         => $lastName,
            'email'             => "demo.applicant{$this->counter}@test.com",
            'mobile_number'     => '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT),
            'password'          => $this->applicantPasswordHash,
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
            $profileData['birthdate']             = now()->subYears(rand(15, 17))->subDays(rand(0, 364));
            $profileData['guardian_first_name']   = 'Guardian';
            $profileData['guardian_last_name']    = "Of{$lastName}";
            $profileData['guardian_relationship'] = collect(['Mother', 'Father', 'Guardian'])->random();
        } else {
            $profileData['birthdate'] = now()->subYears(rand(18, 24))->subDays(rand(0, 364));
        }

        StudentProfile::create($profileData);

        return $user;
    }
}