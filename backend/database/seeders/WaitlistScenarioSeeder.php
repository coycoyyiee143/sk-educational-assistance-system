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

        // Active period, deliberately created AT capacity from the start —
        // 40 approved against a 40 slot_limit — so waitlisted applicants
        // and freed-slot math are consistent from the moment this seeder
        // finishes, no post-hoc adjustment needed.
        $config = ApplicationConfiguration::create([
            'school_year'  => '2026-2027',
            'open_date'    => now()->subDays(10)->startOfDay(),
            'close_date'   => now()->addDays(4)->endOfDay(),
            'slot_limit'   => 40,
            'slots_filled' => 40,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);

        $this->seedApprovedApplicants($config, 40);
        $this->seedWaitlistedApplicants($config, 5);

        $schedule = $this->seedClaimingSchedule($config);

        // 3 not_cleared (claiming-day rejections) + 2 unclaimed (no-shows,
        // still eligible to retry during grace period) — 5 freed slots
        // total. Only not_cleared actively offers its slot to the waitlist
        // per the team's confirmed business rule; unclaimed just needs to
        // show up correctly in the Grace Period Claiming List as a retry.
        $this->seedNotClearedOutcomes($config, $schedule, 3, startingAt: 0);
        $this->seedUnclaimedOutcomes($config, $schedule, 2, startingAt: 3);

        $this->command->info('Waitlist scenario seeded: period at capacity (40/40), 5 waitlisted applicants, 3 not_cleared + 2 unclaimed freed slots, grace period set for notification and Grace Period Claiming List testing.');
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
        // Grace period set to next week so ClaimingScheduleNotification's
        // grace-period branch actually gets exercised, not the fallback.
        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_published'          => true,
            'published_at'          => now()->subDays(2),
            'grace_period_date'     => now()->addWeek()->startOfWeek()->addDay()->toDateString(),
            'grace_period_end_date' => now()->addWeek()->startOfWeek()->addDays(5)->toDateString(),
        ]);

        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 50,
            'batch'                => 'morning',
            'claiming_date'        => now()->subDays(2)->toDateString(),
        ]);

        return $schedule;
    }

    private function seedNotClearedOutcomes(ApplicationConfiguration $config, ClaimingSchedule $schedule, int $count, int $startingAt): void
    {
        $lane = $schedule->lanes()->first();

        $approvedApps = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->orderBy('id')
            ->skip($startingAt)
            ->take($count)
            ->get();

        foreach ($approvedApps as $app) {
            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => 'not_cleared',
                'source'               => 'original',
                'reason_categories'    => collect($this->notClearedReasons)->random(1)->values()->all(),
                'verified_by'          => $this->verifier->id,
                'verified_at'          => now()->subDays(1),
            ]);

            $app->update(['status' => 'not_cleared']);
        }

        // Mirrors the real decrement updateClaimStatus() performs.
        $config->decrement('slots_filled', $approvedApps->count());
    }

    private function seedUnclaimedOutcomes(ApplicationConfiguration $config, ClaimingSchedule $schedule, int $count, int $startingAt): void
    {
        $lane = $schedule->lanes()->first();
    
        $approvedApps = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->orderBy('id')
            ->skip($startingAt)
            ->take($count)
            ->get();
    
        foreach ($approvedApps as $app) {
            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => 'unclaimed',
                'source'               => 'original',
                'verified_by'          => $this->verifier->id,
                'verified_at'          => now()->subDays(1),
            ]);
    
            $app->update(['status' => 'unclaimed']);
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