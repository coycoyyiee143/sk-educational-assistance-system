<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class WaitlistScenarioSeeder extends Seeder
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

    private array $notClearedReasons = [
        'Physical documents did not match submitted application.',
        'Document appeared altered or invalid.',
        'Registration Form not a certified true copy or missing dry seal.',
        'Applicant did not bring all required physical documents.',
    ];

    private ?User $verifier = null;

    public function run(): void
    {
        $this->verifier = User::where('role', 'sk_verifier')->first();
        if (!$this->verifier) {
            $this->command->error('No sk_verifier user found in the database. Create one first, then re-run this seeder.');
            return;
        }

        $admin = User::where('role', 'sk_admin')->first();

        DB::transaction(function () use ($admin) {
            ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

            $config = ApplicationConfiguration::create([
                'school_year'        => '2026-2027 (Test)',
                'open_date'          => now()->subDays(10)->startOfDay(),
                'close_date'         => now()->subDays(3)->endOfDay(),
                'slot_limit'         => 30,
                'slots_filled'       => 30,
                'is_unlimited'       => false,
                'is_active'          => true,
                'assistance_amount'  => 2000,
                'created_by'         => $admin?->id,
            ]);

            $this->seedApprovedApplicants($config, 30);
            $this->seedWaitlistedApplicants($config, 5);

            $schedule = $this->seedClaimingSchedule($config);

            // Frozen, ordered-by-id list of exactly the 30 originally-
            // approved applicants, captured ONCE right after assignment.
            // Every step below slices THIS SAME list — never re-queries
            // Application::where('status','approved') again, since each
            // prior step mutates status and would shift what "approved"
            // even means by the time the next step runs. That reindexing
            // bug previously caused claimed/no-show counts to drift.
            $assignedApps = $this->assignApprovedApplicantsToLane($config, $schedule);

            // Indices 0-2: not_cleared (3 apps)
            $this->seedNotClearedOutcomes($config, $assignedApps->slice(0, 3));

            // Indices 3-4: left untouched as unswept no-shows (2 apps) —
            // stays pending_claiming/original from the assignment step
            // above, which is what makes them grace-period-eligible per
            // GracePeriodEligibility rule 2. Nothing to do here.

            // Indices 5-29: claimed (25 apps)
            $this->seedClaimedOutcomes($config, $schedule, $assignedApps->slice(5));
        });

        $this->command->info('Waitlist scenario seeded: period at capacity (30/30), 5 waitlisted applicants, 3 not_cleared freed slots, 2 unswept no-shows currently grace-period-eligible.');
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
                'submitted_at'      => now()->subDays(rand(1, 9)),
            ]);
        }
    }

    private function seedWaitlistedApplicants(ApplicationConfiguration $config, int $count): void
    {
        $times = [
            now()->subDays(3),
            now()->subDays(2)->subHours(5),
            now()->subDays(1),
            now()->subHours(6),
            now()->subHours(1),
        ];

        foreach (array_slice($times, 0, $count) as $waitlistedAt) {
            $applicant = $this->makeApplicant();
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '2026-W' . str_pad((string) rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'waitlisted',
                'waitlisted_at'     => $waitlistedAt,
                'submitted_at'      => $waitlistedAt->copy()->subHours(rand(1, 12)),
            ]);
        }
    }

    private function seedClaimingSchedule(ApplicationConfiguration $config): ClaimingSchedule
    {
        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_active'             => true,
            'activated_at'          => now()->subDays(2),
            'grace_period_date'     => now()->subDay()->toDateString(),
            'grace_period_end_date' => now()->addDays(5)->toDateString(),
        ]);

        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 30,
            'batch'                => 'morning',
            'claiming_date'        => now()->subDays(2)->toDateString(),
        ]);

        return $schedule;
    }

    /**
     * Assigns every originally-approved applicant to the lane, and
     * returns the exact ordered-by-id Collection of Application models
     * it just assigned. This return value is the single source of truth
     * every later step slices against — nobody re-queries 'status =
     * approved' again, since that status gets mutated as later steps
     * run and would silently shift what "approved" means each time.
     */
    private function assignApprovedApplicantsToLane(ApplicationConfiguration $config, ClaimingSchedule $schedule)
    {
        $lane = $schedule->lanes()->first();

        $approvedApps = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->orderBy('id')
            ->get();

        foreach ($approvedApps as $app) {
            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => 'pending_claiming',
                'source'               => 'original',
            ]);
        }

        return $approvedApps->values();
    }

    private function seedNotClearedOutcomes(ApplicationConfiguration $config, $apps): void
    {
        foreach ($apps as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claim_status'       => 'not_cleared',
                'reason_categories'  => collect($this->notClearedReasons)->random(1)->values()->all(),
                'verified_by'        => $this->verifier->id,
                'verified_at'        => now()->subDays(1),
            ]);

            $app->update(['status' => 'not_cleared']);
        }

        $config->decrement('slots_filled', $apps->count());
    }

    private function seedClaimedOutcomes(ApplicationConfiguration $config, ClaimingSchedule $schedule, $apps): void
    {
        $lane = $schedule->lanes()->first();

        foreach ($apps as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claim_status'       => 'claimed',
                'verified_documents' => [],
                'verified_by'        => $this->verifier->id,
                'verified_at'        => $lane->claiming_date,
                'amount'             => $config->assistance_amount,
            ]);

            $app->update(['status' => 'claimed']);
        }
    }

    private function makeApplicant(): User
    {
        static $counter = 0;
        $counter++;

        $user = User::create([
            'first_name'        => 'Waitlist',
            'middle_name'       => 'Demo',
            'last_name'         => 'Applicant' . $counter,
            'email'             => "waitlist.demo{$counter}@test.com",
            'mobile_number'     => '09' . str_pad((string) rand(0, 999999999), 9, '0', STR_PAD_LEFT),
            'password'          => Hash::make('applicant123'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        StudentProfile::create([
            'user_id'             => $user->id,
            'barangay'            => 'Mamatid',
            'is_profile_complete' => true,
            'birthdate'           => now()->subYears(rand(18, 24))->subDays(rand(0, 364)),
        ]);

        return $user;
    }
}