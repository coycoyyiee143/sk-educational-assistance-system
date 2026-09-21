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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds ONE cohesive, realistic-looking application period so the admin
 * Dashboard, Application Settings, and Schedules pages all have
 * meaningful demo data at once — for screenshotting "how this is
 * supposed to look/be used" rather than an empty or single-purpose test
 * scenario (see OpenApplicationPeriodSeeder for the "still accepting
 * submissions" state, and WaitlistScenarioSeeder for a Late-Claiming-
 * focused one — this one is deliberately the "steady state, well into
 * claiming" picture instead).
 *
 * Application period: opened 30 days ago, closed 15 days ago (deadline
 * passed, but not officially closed via Close Period — so Application
 * Settings shows that specific notice + the Extend/Close Period actions
 * still available). Claiming days are dated after close_date as the
 * real store() validation requires, both already in the past, so some
 * applicants have real resolved outcomes (claimed/not_cleared/unclaimed)
 * for the Dashboard's stat cards and Reports to have real numbers
 * to show, alongside a currently-OPEN Late Claiming window so that
 * section has live content too.
 *
 * Control numbers use the real production format (SK-{year}-{4-digit
 * sequence}), continuing from whatever the highest existing one already
 * is — see Application::tryApprove()'s own MAX-based approach.
 */
class AdminFeatureDemoSeeder extends Seeder
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
        'Applicant does not meet program eligibility requirements.',
    ];

    private array $notClearedReasons = [
        'Physical documents did not match submitted application.',
        'Unable to present valid ID during claiming.',
    ];

    public const SCHOOL_YEAR = '2026-2027';

    private int $counter = 0;
    private ?User $verifier = null;
    private ?ClaimingLane $laneA = null;
    private ?ClaimingLane $laneB = null;
    private ?ClaimingLane $lateClaimingLane = null;

    public function run(): void
    {
        $admin = User::where('role', 'sk_admin')->first();
        $this->verifier = User::where('role', 'sk_verifier')->first();
        if (!$admin || !$this->verifier) {
            $this->command->error('Run OpeningDaySeeder first — it creates the admin/verifier accounts this seeder builds on top of.');
            return;
        }

        $openDate = now()->subDays(30)->startOfDay();
        $closeDate = now()->subDays(15)->endOfDay();

        $this->cleanupPreviousRun($openDate, $closeDate);

        DB::transaction(function () use ($admin, $openDate, $closeDate) {
            // Deactivate whatever else was already active — see the same
            // fix applied to DemoDataSeeder/FullDemoSeeder/MainSeeder;
            // without this, two rows end up simultaneously is_active=true.
            ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

            $config = ApplicationConfiguration::create([
                'school_year'       => self::SCHOOL_YEAR,
                'open_date'         => $openDate,
                'close_date'        => $closeDate,
                'slot_limit'        => 50,
                'slots_filled'      => 0,
                'is_unlimited'      => false,
                'assistance_amount' => 2000,
                'is_active'         => true,
                'created_by'        => $admin->id,
            ]);

            // ── Still-in-queue backlog (small — this is a period well
            //    past its deadline, so only stragglers remain) ──
            $this->seedPlainStatus($config, 'pending_prescreening', 2);
            $this->seedPlainStatus($config, 'for_review', 1);
            $this->seedReuploadRequested($config);

            // ── Rejected + one appeal ──
            $this->seedRejected($config, 1);
            $this->seedAppealed($config);

            // ── Approved pool — assigned across two real claiming lanes
            //    with a realistic spread of outcomes ──
            $approvedApps = $this->seedApproved($config, 19);

            $schedule = $this->seedSchedule($config);
            $this->assignApprovedApplicants($schedule, $approvedApps);

            // Slice: [0-9] claimed, [10-12] not_cleared, [13-14] unclaimed
            // (original no-show, never resolved), [15-16] swept into a
            // Late Claiming retry (still pending), [17-18] left as a
            // normal still-pending original assignment.
            $this->seedClaimedOutcomes($config, $approvedApps->slice(0, 10));
            $this->seedNotClearedOutcomes($config, $approvedApps->slice(10, 3));
            $this->seedUnclaimedOutcomes($approvedApps->slice(13, 2));
            $this->seedSweptRetryOutcomes($approvedApps->slice(15, 2));

            $config->update(['slots_filled' => Application::where('config_id', $config->id)
                ->where('status', 'approved')
                ->count()]);

            // ── Two waitlist promotions during the (currently open) Late
            //    Claiming window — one still pending, one already claimed ──
            $this->seedPromoted($config, 2);
        });

        $this->command->info(
            'Admin feature demo seeded: ' . self::SCHOOL_YEAR . ' — period closed 15 days ago (deadline passed, ' .
            'not officially closed), 2 claiming days already resolved with a realistic outcome mix ' .
            '(claimed/not_cleared/unclaimed/retrying), Late Claiming currently open with 2 waitlist promotions. ' .
            'Covers Dashboard stats, Application Settings notices, and Schedules (live lane lists + Late Claiming list).'
        );
    }

    /**
     * Matched on school_year + the fixed offsets this seeder always uses
     * (open 30 days ago, close 15 days ago at the moment it runs) rather
     * than school_year alone — several other seeders also use plain
     * "2026-2027" for their own scenarios, and wiping every config with
     * that label would delete their data too.
     */
    private function cleanupPreviousRun($openDate, $closeDate): void
    {
        $oldConfigIds = ApplicationConfiguration::where('school_year', self::SCHOOL_YEAR)
            ->whereDate('open_date', $openDate->toDateString())
            ->whereDate('close_date', $closeDate->toDateString())
            ->pluck('id');

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

    private function makeApplicant(): User
    {
        $this->counter++;
        $n = $this->counter;

        $user = User::create([
            'first_name'        => 'Demo',
            'middle_name'       => 'Feature',
            'last_name'         => 'Applicant' . $n,
            'email'             => "featuredemo{$n}@test.com",
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

    private function makeApplication(ApplicationConfiguration $config, array $overrides = []): Application
    {
        $applicant = $this->makeApplicant();

        $app = Application::create(array_merge([
            'user_id'           => $applicant->id,
            'config_id'         => $config->id,
            'school_name'       => $this->schools[array_rand($this->schools)],
            'course'            => $this->courses[array_rand($this->courses)],
            'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
            'student_id_number' => '2026-' . str_pad((string) $this->counter, 4, '0', STR_PAD_LEFT),
            'submitted_at'      => $config->open_date->copy()->addDays(rand(1, 10)),
        ], $overrides));

        // AdminController::stats()'s "Total" count is whereHas('documents')
        // — everything without at least one document row falls under
        // "Incomplete" instead, regardless of its actual status. Every
        // status seeded here implies real documents were submitted, so
        // attach placeholders to all of them (skip only for a genuine
        // draft_incomplete, which by definition hasn't finished
        // uploading yet).
        if (($overrides['status'] ?? null) !== 'draft_incomplete') {
            foreach (['registration_form', 'school_id', 'voters_certificate'] as $docType) {
                ApplicationDocument::create([
                    'application_id' => $app->id,
                    'document_type'  => $docType,
                    'file_path'      => "documents/{$app->id}/seeded_placeholder_{$docType}.jpg",
                    'file_name'      => "seeded_placeholder_{$docType}.jpg",
                    'mime_type'      => 'image/jpeg',
                    'version'        => 1,
                    'status'         => 'processed',
                ]);
            }
        }

        return $app;
    }

    private function seedPlainStatus(ApplicationConfiguration $config, string $status, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->makeApplication($config, ['status' => $status]);
        }
    }

    private function seedReuploadRequested(ApplicationConfiguration $config): void
    {
        $app = $this->makeApplication($config, ['status' => 'reupload_requested']);

        VerifierAction::create([
            'application_id'    => $app->id,
            'verifier_id'       => $this->verifier->id,
            'action'            => 'reupload_requested',
            'reason_categories' => ['registration_form'],
            'notes'             => 'Image blurry or unreadable — please re-upload a clearer copy of your Registration Form.',
        ]);
    }

    private function seedRejected(ApplicationConfiguration $config, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $reason = $this->rejectionReasons[$i % count($this->rejectionReasons)];

            $app = $this->makeApplication($config, [
                'status'           => 'rejected',
                'rejection_reason' => $reason,
            ]);

            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $this->verifier->id,
                'action'            => 'rejected',
                'reason_categories' => ['eligibility'],
                'notes'             => $reason,
            ]);
        }
    }

    private function seedAppealed(ApplicationConfiguration $config): void
    {
        $reason = $this->rejectionReasons[0];

        $app = $this->makeApplication($config, [
            'status'           => 'appeal_requested',
            'rejection_reason' => $reason,
            'appeal_reason'    => 'I have attached an updated, certified copy of my Voter\'s Certificate — please reconsider my application.',
            'appealed_at'      => now()->subDays(2),
        ]);

        VerifierAction::create([
            'application_id'    => $app->id,
            'verifier_id'       => $this->verifier->id,
            'action'            => 'rejected',
            'reason_categories' => ['eligibility'],
            'notes'             => $reason,
        ]);
    }

    /**
     * Returns the created approved applications, in creation order, so
     * the caller can slice them straight into claim outcomes. Alternates
     * between a real VerifierAction ("Approved") and none at all
     * ("System Approved" per getVerifierStatusLabel()).
     */
    private function seedApproved(ApplicationConfiguration $config, int $count)
    {
        $prefix = 'SK-' . $config->open_date->format('Y') . '-';
        $nextSeq = (int) Application::where('control_number', 'like', $prefix . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(control_number, ?) AS UNSIGNED)) as max_seq", [strlen($prefix) + 1])
            ->value('max_seq') + 1;

        $apps = collect();

        for ($i = 0; $i < $count; $i++) {
            $app = $this->makeApplication($config, [
                'status'         => 'approved',
                'control_number' => $prefix . str_pad((string) ($nextSeq + $i), 4, '0', STR_PAD_LEFT),
            ]);

            if ($i % 2 === 0) {
                VerifierAction::create([
                    'application_id' => $app->id,
                    'verifier_id'    => $this->verifier->id,
                    'action'         => 'approved',
                ]);
            }

            $apps->push($app);
        }

        return $apps;
    }

    /**
     * Two claiming days, both already past (14 and 13 days ago — safely
     * after close_date, 15 days ago), each with a morning + afternoon
     * lane. Late Claiming is currently open (started 6 days ago, ends 4
     * days from now) so that section has live, "currently in progress"
     * content too, not just already-resolved history.
     */
    private function seedSchedule(ApplicationConfiguration $config): ClaimingSchedule
    {
        $schedule = ClaimingSchedule::create([
            'config_id'              => $config->id,
            'location'               => 'Barangay Mamatid Covered Court',
            'morning_start'          => '08:00',
            'morning_end'            => '12:00',
            'afternoon_start'        => '13:00',
            'afternoon_end'          => '17:00',
            'is_active'              => true,
            'activated_at'           => now()->subDays(14),
            'late_claiming_date'     => now()->subDays(6)->toDateString(),
            'late_claiming_end_date' => now()->addDays(4)->toDateString(),
        ]);

        $this->laneA = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 15,
            'batch'                => 'morning',
            'claiming_date'        => now()->subDays(14)->toDateString(),
            'verifier_id'          => $this->verifier->id,
        ]);

        $this->laneB = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane B',
            'capacity'             => 15,
            'batch'                => 'afternoon',
            'claiming_date'        => now()->subDays(13)->toDateString(),
        ]);

        // Matches the real lane naming used by VerifierController's
        // promotion flow and the sweep command — promotions and swept
        // no-shows both land on this one flexible, unscheduled lane.
        $this->lateClaimingLane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Late Claiming',
            'capacity'             => null,
            'batch'                => 'morning',
            'claiming_date'        => $schedule->late_claiming_date,
        ]);

        return $schedule;
    }

    /** Splits the approved pool evenly across Lane A and Lane B. */
    private function assignApprovedApplicants(ClaimingSchedule $schedule, $apps): void
    {
        foreach ($apps->values() as $i => $app) {
            $lane = $i % 2 === 0 ? $this->laneA : $this->laneB;

            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => 'pending_claiming',
                'source'               => 'original',
            ]);
        }
    }

    private function seedClaimedOutcomes($config, $apps): void
    {
        foreach ($apps as $app) {
            $assignment = ClaimingAssignment::where('application_id', $app->id)->first();
            $lane = $assignment->claiming_lane_id === $this->laneA->id ? $this->laneA : $this->laneB;

            $assignment->update([
                'claim_status'       => 'claimed',
                'verified_documents' => ['registration_form', 'school_id', 'voters_certificate'],
                'verified_by'        => $this->verifier->id,
                'verified_at'        => $lane->claiming_date,
                'amount'             => $config->assistance_amount,
            ]);

            $app->update(['status' => 'claimed']);
        }
    }

    private function seedNotClearedOutcomes($config, $apps): void
    {
        foreach ($apps as $app) {
            $assignment = ClaimingAssignment::where('application_id', $app->id)->first();
            $lane = $assignment->claiming_lane_id === $this->laneA->id ? $this->laneA : $this->laneB;

            $assignment->update([
                'claim_status'      => 'not_cleared',
                'reason_categories' => collect($this->notClearedReasons)->random(1)->values()->all(),
                'verified_by'       => $this->verifier->id,
                'verified_at'       => $lane->claiming_date,
            ]);

            $app->update(['status' => 'not_cleared']);
        }
    }

    /**
     * Original no-show whose window lapsed with no claim and was never
     * retried — the terminal, unsuccessful "nobody did anything about
     * it" outcome. In the real system this happens via a scheduled
     * sweep; seeded directly here since we're not running that command.
     */
    private function seedUnclaimedOutcomes($apps): void
    {
        foreach ($apps as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claim_status' => 'unclaimed',
            ]);
        }
    }

    /**
     * Mirrors SweepUnclaimedAssignments' reassignment step: moves an
     * overdue 'original' assignment onto the flexible Late Claiming lane
     * and flips source to late_claiming_retry, leaving claim_status
     * untouched (still pending_claiming — a retry is not a resolution
     * yet, it's what makes them show up in the Late Claiming pool as
     * "Retrying").
     */
    private function seedSweptRetryOutcomes($apps): void
    {
        foreach ($apps as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claiming_lane_id' => $this->lateClaimingLane->id,
                'source'           => 'late_claiming_retry',
            ]);
        }
    }

    /**
     * Promotes N applicants off a waitlist straight into the Late
     * Claiming pool — mirrors what VerifierController's promotion flow
     * actually does (status -> approved, control_number assigned,
     * ClaimingAssignment created with source: waitlist_promotion). Since
     * this config's slot_limit (50) comfortably exceeds everyone already
     * approved, these are genuinely NEW slots opening up (e.g. a prior
     * not_cleared freeing room), not a real waitlist backlog — no
     * waitlisted rows are seeded here since that scenario already has
     * its own dedicated seeder (WaitlistScenarioSeeder).
     */
    private function seedPromoted($config, int $count): void
    {
        $prefix = 'SK-' . $config->open_date->format('Y') . '-';
        $nextSeq = (int) Application::where('control_number', 'like', $prefix . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(control_number, ?) AS UNSIGNED)) as max_seq", [strlen($prefix) + 1])
            ->value('max_seq') + 1;

        for ($i = 0; $i < $count; $i++) {
            $app = $this->makeApplication($config, [
                'status'         => 'approved',
                'control_number' => $prefix . str_pad((string) ($nextSeq + $i), 4, '0', STR_PAD_LEFT),
            ]);

            $assignment = ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $this->lateClaimingLane->claiming_schedule_id,
                'claiming_lane_id'     => $this->lateClaimingLane->id,
                'claim_status'         => 'pending_claiming',
                'source'               => 'waitlist_promotion',
            ]);

            $config->increment('slots_filled');

            // Second one resolved claimed, so "Promoted" shows both a
            // still-pending and an already-resolved example.
            if ($i === 1) {
                $assignment->update([
                    'claim_status'       => 'claimed',
                    'verified_documents' => ['registration_form', 'school_id', 'voters_certificate'],
                    'verified_by'        => $this->verifier->id,
                    'verified_at'        => now()->subDays(2),
                    'amount'             => $config->assistance_amount,
                ]);
                $app->update(['status' => 'claimed']);
            }
        }
    }
}
