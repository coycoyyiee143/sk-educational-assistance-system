<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingFaceVerification;
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

    public const SCHOOL_YEAR = '2026-2027 (Test)';

    public function run(): void
    {
        $this->cleanupPreviousRun();

        $this->verifier = User::where('role', 'sk_verifier')->first();
        if (!$this->verifier) {
            $this->command->error('No sk_verifier user found in the database. Create one first, then re-run this seeder.');
            return;
        }

        $admin = User::where('role', 'sk_admin')->first();

        DB::transaction(function () use ($admin) {
            ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

            $config = ApplicationConfiguration::create([
                'school_year'        => self::SCHOOL_YEAR,
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
            $waitlistedApps = $this->seedWaitlistedApplicants($config, 6);

            $schedule = $this->seedClaimingSchedule($config);
            $lateClaimingLane = $this->seedLateClaimingLane($schedule);

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
            // above, which is what makes them Late-Claiming-eligible per
            // LateClaimingEligibility rule 2. Nothing to do here.

            // Indices 5-6: already-swept retries (2 apps) — reassigned
            // onto the Late Claiming lane with source flipped to
            // late_claiming_retry, exactly what SweepUnclaimedAssignments
            // does. Gives a "Retrying" example that isn't just an unswept
            // original, alongside indices 3-4 above.
            $this->seedSweptRetryOutcomes($lateClaimingLane, $assignedApps->slice(5, 2));

            // Indices 7-29: claimed (23 apps)
            $this->seedClaimedOutcomes($config, $schedule, $assignedApps->slice(7));

            // Promote 4 of the 6 waitlisted applicants onto the Late
            // Claiming lane — this is what actually exercises the
            // "Promoted" badge, across four different outcomes:
            //  0: pending, no face verification yet (tests the required
            //     gate from scratch)
            //  1: pending, WITH a FAILED face verification already on
            //     record (tests that a failed attempt still blocks
            //     Claimed — must retry, not just attempt once)
            //  2: resolved not_cleared (a promoted applicant who then
            //     ALSO failed physical verification — frees their slot
            //     again, demonstrating the cascade)
            //  3: resolved claimed, with a passing face verification
            // The other 2 stay waitlisted.
            $this->seedPromotedOutcomes($config, $lateClaimingLane, $waitlistedApps->slice(0, 4));
        });

        $this->command->info('Waitlist scenario seeded: period at capacity (30/30, back to 30/30 after 4 promotions absorb the freed slots), 2 still waitlisted, 4 not_cleared total (3 original + 1 cascaded from a promoted applicant), Late Claiming pool has 2 unswept no-shows, 2 swept retries, 1 pending promotion (no face verification), 1 pending promotion (failed face verification on record), 1 resolved not_cleared promotion, and 1 resolved claimed promotion.');
    }

    /**
     * Wipes out this seeder's own previous run (matched by school_year)
     * before creating a fresh one, so control numbers/emails can stay
     * clean and sequential instead of needing a per-run uniqueness
     * token. Deleting the demo applicant users cascades (FK onDelete:
     * cascade) through their applications, application_documents,
     * claiming_assignments and claiming_face_verifications — only the
     * schedule/lanes/config need deleting explicitly afterward. Never
     * touches your real admin/verifier accounts, since only applicant-
     * role users tied to this scenario's config are deleted.
     */
    private function cleanupPreviousRun(): void
    {
        // ALL matching configs, not just the first — earlier versions of
        // this seeder (before cleanup existed) could leave more than one
        // behind under the same school_year, and cleaning only one while
        // leaving another's demo users in place is exactly what caused
        // the fresh run to collide with those stragglers' emails.
        $oldConfigIds = ApplicationConfiguration::where('school_year', self::SCHOOL_YEAR)->pluck('id');
        if ($oldConfigIds->isEmpty()) {
            return;
        }

        $userIds = Application::whereIn('config_id', $oldConfigIds)->pluck('user_id');
        User::whereIn('id', $userIds)->where('role', 'applicant')->delete();

        $scheduleIds = ClaimingSchedule::whereIn('config_id', $oldConfigIds)->pluck('id');
        ClaimingLane::whereIn('claiming_schedule_id', $scheduleIds)->delete();
        ClaimingSchedule::whereIn('id', $scheduleIds)->delete();

        ApplicationConfiguration::whereIn('id', $oldConfigIds)->delete();
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
                'control_number'    => 'SK-WLTEST-' . now()->format('Y') . '-' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'submitted_at'      => now()->subDays(rand(1, 9)),
            ]);
        }
    }

    /**
     * Returns the created applications, oldest-waitlisted-first (matching
     * FCFS promotion order), so the caller can promote off the front of
     * this same list without re-querying 'status = waitlisted' — that
     * status changes the moment a promotion happens, same reindexing
     * hazard documented on assignApprovedApplicantsToLane() above.
     */
    private function seedWaitlistedApplicants(ApplicationConfiguration $config, int $count)
    {
        $times = [
            now()->subDays(3),
            now()->subDays(2)->subHours(5),
            now()->subDays(1),
            now()->subHours(6),
            now()->subHours(3),
            now()->subHours(1),
        ];

        $apps = collect();

        foreach (array_slice($times, 0, $count) as $waitlistedAt) {
            $applicant = $this->makeApplicant();
            $apps->push(Application::create([
                'user_id'           => $applicant->id,
                'config_id'         => $config->id,
                'school_name'       => $this->schools[array_rand($this->schools)],
                'course'            => $this->courses[array_rand($this->courses)],
                'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
                'student_id_number' => '2026-W' . str_pad((string) rand(1, 9999), 4, '0', STR_PAD_LEFT),
                'status'            => 'waitlisted',
                'waitlisted_at'     => $waitlistedAt,
                'submitted_at'      => $waitlistedAt->copy()->subHours(rand(1, 12)),
            ]));
        }

        return $apps;
    }

    private function seedClaimingSchedule(ApplicationConfiguration $config): ClaimingSchedule
    {
        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_active'             => true,
            'activated_at'          => now()->subDays(2),
            'late_claiming_date'     => now()->subDay()->toDateString(),
            'late_claiming_end_date' => now()->addDays(5)->toDateString(),
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
     * Matches the real lane naming used by VerifierController's promotion
     * flow (promoteFromWaitlist/promoteAllFromWaitlist) and the sweep
     * command — waitlist promotions and swept no-shows both always land
     * on this one flexible, unscheduled lane rather than a dated one.
     */
    private function seedLateClaimingLane(ClaimingSchedule $schedule): ClaimingLane
    {
        return ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Late Claiming',
            'capacity'             => null,
            'batch'                => 'morning',
            'claiming_date'        => $schedule->late_claiming_date,
        ]);
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

    /**
     * Mirrors SweepUnclaimedAssignments' reassignment step: moves an
     * overdue 'original' assignment onto the flexible Late Claiming lane
     * and flips source to late_claiming_retry, leaving claim_status
     * untouched (still pending_claiming — a retry is not a resolution).
     */
    private function seedSweptRetryOutcomes(ClaimingLane $lateClaimingLane, $apps): void
    {
        foreach ($apps as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claiming_lane_id' => $lateClaimingLane->id,
                'source'           => 'late_claiming_retry',
            ]);
        }
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

    /**
     * Mirrors what Application::tryApprove() + VerifierController's
     * promotion flow actually do (status -> approved, control_number
     * assigned, slots_filled incremented, ClaimingAssignment created on
     * the Late Claiming lane with source: waitlist_promotion) for every
     * app passed in, then resolves each into a distinct outcome by
     * index — see the call site for what each index demonstrates.
     * Expects exactly 4 apps.
     */
    private function seedPromotedOutcomes(ApplicationConfiguration $config, ClaimingLane $lateClaimingLane, $apps): void
    {
        $apps = $apps->values();
        $nextSequence = 31;

        foreach ($apps as $app) {
            $app->update([
                'status'         => 'approved',
                'control_number' => 'SK-WLTEST-' . now()->format('Y') . '-' . str_pad((string) $nextSequence, 4, '0', STR_PAD_LEFT),
            ]);
            $nextSequence++;

            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $lateClaimingLane->claiming_schedule_id,
                'claiming_lane_id'     => $lateClaimingLane->id,
                'claim_status'         => 'pending_claiming',
                'source'               => 'waitlist_promotion',
            ]);

            $config->increment('slots_filled');
        }

        // Index 0: left pending, untouched — no face verification at all,
        // the "test the required gate from a clean slate" case.

        // Index 1: pending, but with a FAILED face verification already
        // on record — proves a failed attempt still blocks Claimed
        // rather than being treated as "already tried, close enough".
        $failedAttempt = $apps->get(1);
        if ($failedAttempt) {
            $assignment = ClaimingAssignment::where('application_id', $failedAttempt->id)->first();

            ClaimingFaceVerification::create([
                'claiming_assignment_id' => $assignment->id,
                'verified_by'            => $this->verifier->id,
                'claiming_photo_path'    => "claiming_faces/seeded_placeholder_{$assignment->id}.jpg",
                'match_score'            => 0.31,
                'matched'                => false,
                'verified_at'            => now(),
            ]);
        }

        // Index 2: resolved not_cleared — a promoted applicant who then
        // ALSO failed physical verification during Late Claiming. No face
        // verification is required for not_cleared, only for claimed.
        // Frees their slot again, same rule as any other not_cleared.
        $cascadedNotCleared = $apps->get(2);
        if ($cascadedNotCleared) {
            ClaimingAssignment::where('application_id', $cascadedNotCleared->id)->update([
                'claim_status'       => 'not_cleared',
                'reason_categories'  => collect($this->notClearedReasons)->random(1)->values()->all(),
                'verified_by'        => $this->verifier->id,
                'verified_at'        => now(),
            ]);

            $cascadedNotCleared->update(['status' => 'not_cleared']);
            $config->decrement('slots_filled');
        }

        // Index 3: resolved claimed, with a passing face verification on
        // record first (matches the real precondition updateClaimStatus
        // enforces before allowing 'claimed' during Late Claiming).
        $resolvedClaimed = $apps->get(3);
        if ($resolvedClaimed) {
            $assignment = ClaimingAssignment::where('application_id', $resolvedClaimed->id)->first();

            ClaimingFaceVerification::create([
                'claiming_assignment_id' => $assignment->id,
                'verified_by'            => $this->verifier->id,
                'claiming_photo_path'    => "claiming_faces/seeded_placeholder_{$assignment->id}.jpg",
                'match_score'            => 0.94,
                'matched'                => true,
                'verified_at'            => now(),
            ]);

            $assignment->update([
                'claim_status'       => 'claimed',
                'verified_documents' => [],
                'verified_by'        => $this->verifier->id,
                'verified_at'        => now(),
                'amount'             => $config->assistance_amount,
            ]);

            $resolvedClaimed->update(['status' => 'claimed']);
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