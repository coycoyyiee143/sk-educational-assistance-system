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

/**
 * Seeds a REGULAR claiming day scenario — deliberately separate from
 * WaitlistScenarioSeeder's grace-period-focused one, since a regular
 * lane's claiming_date can never coincide with an open grace period (see
 * VerifierClaimingUiTestSeeder's docblock: grace period only opens once
 * every regular lane's date has already passed). This schedule has NO
 * grace_period_date/end at all, so nothing here leaks into the Grace
 * Period List.
 *
 * Scenario: 3 verifiers, each assigned their own lane by control-number
 * range (Lane A 1-10, Lane B 11-20, Lane C 21-30), all pending — nothing
 * pre-resolved, so a live demo can show:
 *  - Each verifier only sees their own lane's applicants.
 *  - Slots are maxed (30/30) — a few extra applicants beyond that are
 *    already sitting on the waitlist.
 *  - Marking someone Not Cleared live frees a slot (config->slots_filled
 *    drops below slot_limit), which only THEN makes waitlist promotion
 *    possible (VerifierController::promoteFromWaitlist requires
 *    close_date to have already passed, which it has here).
 */
class ClaimingDayTestSeeder extends Seeder
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

    // Unique per run so this seeder can be re-run without a fresh
    // migration first — every email/control_number includes this token.
    private string $runToken = '';

    public function run(): void
    {
        $this->runToken = substr(uniqid(), -6);

        $primaryVerifier = User::where('role', 'sk_verifier')->first();
        if (!$primaryVerifier) {
            $this->command->error('No sk_verifier user found in the database. Create one first, then re-run this seeder.');
            return;
        }

        $admin = User::where('role', 'sk_admin')->first();

        // Two extra verifier accounts, only created if they don't exist
        // yet — never touches your real verifier account, which becomes
        // Lane A's verifier below.
        $verifier2 = User::firstOrCreate(
            ['email' => 'verifier2@skmamatid.com'],
            [
                'first_name'        => 'SK Verifier',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Two',
                'mobile_number'     => '09' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        $verifier3 = User::firstOrCreate(
            ['email' => 'verifier3@skmamatid.com'],
            [
                'first_name'        => 'SK Verifier',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Three',
                'mobile_number'     => '09' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        DB::transaction(function () use ($admin, $primaryVerifier, $verifier2, $verifier3) {
            ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

            $config = ApplicationConfiguration::create([
                'school_year'        => '2026-2027 (Claiming Day Test)',
                'open_date'          => now()->subDays(15)->startOfDay(),
                'close_date'         => now()->subDay()->endOfDay(),
                'slot_limit'         => 30,
                'slots_filled'       => 30,
                'is_unlimited'       => false,
                'is_active'          => true,
                'assistance_amount'  => 2000,
                'created_by'         => $admin?->id,
            ]);

            $approvedApps = $this->seedApprovedApplicants($config, 30);
            $this->seedWaitlistedApplicants($config, 4);

            $schedule = ClaimingSchedule::create([
                'config_id'    => $config->id,
                'location'     => 'Barangay Mamatid Covered Court',
                'is_active'    => true,
                'activated_at' => now(),
                // Deliberately no grace_period_date/end — this schedule
                // is regular-claiming-only.
            ]);

            $lanes = [
                ['name' => 'Lane A', 'batch' => 'morning', 'verifier' => $primaryVerifier],
                ['name' => 'Lane B', 'batch' => 'morning', 'verifier' => $verifier2],
                ['name' => 'Lane C', 'batch' => 'afternoon', 'verifier' => $verifier3],
            ];

            foreach ($lanes as $i => $laneDef) {
                $lane = ClaimingLane::create([
                    'claiming_schedule_id' => $schedule->id,
                    'lane_name'            => $laneDef['name'],
                    'capacity'             => 10,
                    'batch'                => $laneDef['batch'],
                    'claiming_date'        => now()->toDateString(),
                    'verifier_id'          => $laneDef['verifier']->id,
                ]);

                // Control-number order: apps 1-10 -> Lane A, 11-20 -> Lane
                // B, 21-30 -> Lane C.
                foreach ($approvedApps->slice($i * 10, 10) as $app) {
                    ClaimingAssignment::create([
                        'application_id'       => $app->id,
                        'claiming_schedule_id' => $schedule->id,
                        'claiming_lane_id'     => $lane->id,
                        'claim_status'         => 'pending_claiming',
                        'source'               => 'original',
                    ]);
                }
            }
        });

        $this->command->info('Claiming day scenario seeded: 30/30 slots filled across 3 lanes (10 each) — Lane A your verifier, Lane B verifier2@skmamatid.com, Lane C verifier3@skmamatid.com (password verifier123 for both). 4 extra applicants sit on the waitlist. No grace period configured on this schedule on purpose. Mark someone Not Cleared to free a slot, then Promote from the Waitlist page (close_date has already passed).');
    }

    /**
     * Returns the created applications in control-number order (1..30),
     * so the caller can slice them 10-at-a-time straight into lanes.
     */
    private function seedApprovedApplicants(ApplicationConfiguration $config, int $count)
    {
        $apps = collect();

        for ($i = 1; $i <= $count; $i++) {
            $applicant = $this->makeApplicant($i);
            $apps->push(Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '2026-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'status'            => 'approved',
                'control_number'    => 'SK-CDTEST-' . $this->runToken . '-' . now()->format('Y') . '-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'submitted_at'      => now()->subDays(20 - $i),
            ]));
        }

        return $apps;
    }

    private function seedWaitlistedApplicants(ApplicationConfiguration $config, int $count): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $applicant = $this->makeApplicant(100 + $i);
            Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '2026-W' . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'status'            => 'waitlisted',
                'waitlisted_at'     => now()->subHours($count - $i + 1),
                'submitted_at'      => now()->subHours($count - $i + 1)->subHours(2),
            ]);
        }
    }

    private function makeApplicant(int $seq): User
    {
        $user = User::create([
            'first_name'        => 'ClaimDay',
            'middle_name'       => 'Demo',
            'last_name'         => 'Applicant' . $seq,
            'email'             => "claimday.demo{$seq}.{$this->runToken}@test.com",
            'mobile_number'     => '09' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
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
