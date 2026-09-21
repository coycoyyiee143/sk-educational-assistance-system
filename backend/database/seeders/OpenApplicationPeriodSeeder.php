<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\VerifierAction;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds ONE application period that's still genuinely in its submission
 * window (open_date/close_date both real calendar dates around "today" in
 * this dev environment), for admin/verifier/superadmin dashboard
 * screenshots that should read as "applications are still coming in" —
 * not a closed/claiming-complete scenario like ClaimingDayTestSeeder or
 * WaitlistScenarioSeeder.
 *
 * Deliberately light on volume ("not a lot" in review, "some" approved,
 * "really few" rejected, one appeal) rather than matching
 * BudgetScaleTestSeeder/FullDemoSeeder's realistic-volume scale — this is
 * for screenshots of what the queue/records tables look like mid-period,
 * not for report/analytics testing.
 *
 * Also seeds (but does NOT activate) a ClaimingSchedule for this same
 * config, with the specific dates requested: claiming days Sept 28 and
 * 29, Late Claiming Sept 30 - Oct 9 — all safely after close_date (Sept
 * 25), matching AdminScheduleController::store()'s validation. Left
 * un-activated since claiming can't start until those dates actually
 * arrive; the admin can activate it later once ready to screenshot that
 * state too.
 */
class OpenApplicationPeriodSeeder extends Seeder
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

    public const SCHOOL_YEAR = '2026-2027';
    private const OPEN_DATE = '2026-09-21';
    private const CLOSE_DATE = '2026-09-25';

    private int $counter = 0;

    public function run(): void
    {
        $this->cleanupPreviousRun();

        $admin = User::where('role', 'sk_admin')->first();
        $verifier = User::where('role', 'sk_verifier')->first();
        if (!$admin || !$verifier) {
            $this->command->error('Run OpeningDaySeeder first — it creates the admin/verifier accounts this seeder builds on top of.');
            return;
        }

        DB::transaction(function () use ($admin, $verifier) {
            // Deactivate whatever else was already active first — see the
            // same fix applied to DemoDataSeeder/FullDemoSeeder/MainSeeder;
            // without this, two rows end up simultaneously is_active=true.
            ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

            $config = ApplicationConfiguration::create([
                'school_year'       => self::SCHOOL_YEAR,
                'open_date'         => Carbon::parse(self::OPEN_DATE)->startOfDay(),
                'close_date'        => Carbon::parse(self::CLOSE_DATE)->endOfDay(),
                'slot_limit'        => 50,
                'slots_filled'      => 0,
                'is_unlimited'      => false,
                'assistance_amount' => 2000,
                'is_active'         => true,
                'created_by'        => $admin->id,
            ]);

            // ── In queue for review (not a lot) ──
            $this->seedPlainStatus($config, 'pending_prescreening', 3);
            $this->seedPlainStatus($config, 'for_review', 3);

            // ── Applicant-side variety, so the applicant-facing screens
            //    aren't all "pending" or "approved" ──
            $this->seedDraftIncomplete($config);
            $this->seedReuploadRequested($config, $verifier);
            $this->seedPlainStatus($config, 'auto_reupload_requested', 1);

            // ── Approved (some) — alternating manual vs. no VerifierAction
            //    so "Approved" vs. "System Approved" both show up, per
            //    getVerifierStatusLabel() in StatusConstants.js ──
            $approvedCount = $this->seedApproved($config, $verifier, 12);

            // ── Rejected (really few) + one of them appealed ──
            $this->seedRejected($config, $verifier, 2);
            $this->seedAppealed($config, $verifier);

            $config->update(['slots_filled' => $approvedCount]);

            $this->seedSchedule($config, $verifier);
        });

        $this->command->info(
            'Open application period seeded: ' . self::SCHOOL_YEAR . ', open ' . self::OPEN_DATE .
            ' - close ' . self::CLOSE_DATE . ' (still open). 3 pending_prescreening, 3 for_review, ' .
            '1 draft_incomplete, 1 reupload_requested, 1 auto_reupload_requested, 12 approved, ' .
            '2 rejected, 1 appeal_requested. Claiming schedule drafted (not activated) for Sept 28-29, ' .
            'Late Claiming Sept 30 - Oct 9 — activate it yourself when ready to screenshot that state.'
        );
    }

    /**
     * Matched on school_year + these exact open/close dates rather than
     * school_year alone — several other seeders also use plain "2026-2027"
     * for their own scenarios, and wiping every config with that label
     * would delete their data too. This pair of dates is unique to this
     * seeder's own runs.
     */
    private function cleanupPreviousRun(): void
    {
        $oldConfigIds = ApplicationConfiguration::where('school_year', self::SCHOOL_YEAR)
            ->whereDate('open_date', self::OPEN_DATE)
            ->whereDate('close_date', self::CLOSE_DATE)
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
            'first_name'        => 'Open',
            'middle_name'       => 'Period',
            'last_name'         => 'Applicant' . $n,
            'email'             => "openperiod.demo{$n}@test.com",
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

        return Application::create(array_merge([
            'user_id'           => $applicant->id,
            'config_id'         => $config->id,
            'school_name'       => $this->schools[array_rand($this->schools)],
            'course'            => $this->courses[array_rand($this->courses)],
            'year_level'        => $this->yearLevels[array_rand($this->yearLevels)],
            'student_id_number' => '2026-' . str_pad((string) $this->counter, 4, '0', STR_PAD_LEFT),
            'submitted_at'      => now()->subHours(rand(1, 72)),
        ], $overrides));
    }

    private function seedPlainStatus(ApplicationConfiguration $config, string $status, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->makeApplication($config, ['status' => $status]);
        }
    }

    // Registered and started, but hasn't finished uploading required
    // documents yet — this status is the natural state at creation, not
    // something transitioned into (see StatusConstants.js). No submitted_at
    // since they haven't actually submitted.
    private function seedDraftIncomplete(ApplicationConfiguration $config): void
    {
        $this->makeApplication($config, [
            'status'       => 'draft_incomplete',
            'submitted_at' => null,
        ]);
    }

    // Human verifier looked and asked for a specific document to be
    // redone — always paired with a VerifierAction (see StatusConstants.js
    // — distinct from the auto_reupload_requested case, which never has
    // one).
    private function seedReuploadRequested(ApplicationConfiguration $config, User $verifier): void
    {
        $app = $this->makeApplication($config, ['status' => 'reupload_requested']);

        VerifierAction::create([
            'application_id'    => $app->id,
            'verifier_id'       => $verifier->id,
            'action'            => 'reupload_requested',
            'reason_categories' => ['registration_form'],
            'notes'             => 'Image blurry or unreadable — please re-upload a clearer copy of your Registration Form.',
        ]);
    }

    /**
     * Returns the number of approved applications created. Alternates
     * between a real VerifierAction (shows as "Approved") and none at all
     * (shows as "System Approved" per getVerifierStatusLabel()) so both
     * labels are visible across the batch.
     */
    private function seedApproved(ApplicationConfiguration $config, User $verifier, int $count): int
    {
        // control_number is globally unique across the whole table, not
        // scoped per config — other seeded periods sharing this same
        // "SK-2026-" prefix (year comes from open_date, not config id)
        // already claimed numbers well past any small hardcoded range, so
        // this picks up after whatever the highest existing one is,
        // mirroring Application::tryApprove()'s own MAX-based approach.
        $prefix = 'SK-' . Carbon::parse(self::OPEN_DATE)->format('Y') . '-';
        $nextSeq = (int) Application::where('control_number', 'like', $prefix . '%')
            ->selectRaw("MAX(CAST(SUBSTRING(control_number, ?) AS UNSIGNED)) as max_seq", [strlen($prefix) + 1])
            ->value('max_seq') + 1;

        for ($i = 0; $i < $count; $i++) {
            $app = $this->makeApplication($config, [
                'status'         => 'approved',
                'control_number' => $prefix . str_pad((string) ($nextSeq + $i), 4, '0', STR_PAD_LEFT),
            ]);

            if ($i % 2 === 0) {
                VerifierAction::create([
                    'application_id' => $app->id,
                    'verifier_id'    => $verifier->id,
                    'action'         => 'approved',
                ]);
            }
        }

        return $count;
    }

    private function seedRejected(ApplicationConfiguration $config, User $verifier, int $count): void
    {
        for ($i = 0; $i < $count; $i++) {
            $reason = $this->rejectionReasons[$i % count($this->rejectionReasons)];

            $app = $this->makeApplication($config, [
                'status'           => 'rejected',
                'rejection_reason' => $reason,
            ]);

            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $verifier->id,
                'action'            => 'rejected',
                'reason_categories' => ['eligibility'],
                'notes'             => $reason,
            ]);
        }
    }

    // A rejected applicant who then formally appealed (see
    // ApplicationController::appeal()) — sits in appeal_requested until a
    // verifier resolves it via appealDecision().
    private function seedAppealed(ApplicationConfiguration $config, User $verifier): void
    {
        $reason = $this->rejectionReasons[0];

        $app = $this->makeApplication($config, [
            'status'           => 'appeal_requested',
            'rejection_reason' => $reason,
            'appeal_reason'    => 'I have attached an updated, certified copy of my Voter\'s Certificate — please reconsider my application.',
            'appealed_at'      => now()->subHours(3),
        ]);

        VerifierAction::create([
            'application_id'    => $app->id,
            'verifier_id'       => $verifier->id,
            'action'            => 'rejected',
            'reason_categories' => ['eligibility'],
            'notes'             => $reason,
        ]);
    }

    /**
     * Drafted, not activated — claiming can't start until Sept 28 actually
     * arrives, so there's nothing to assign anyone to yet. Matches the
     * exact dates requested: claiming days Sept 28 and 29 (both safely
     * after close_date, Sept 25), Late Claiming Sept 30 - Oct 9 (safely
     * after the latest claiming date).
     */
    private function seedSchedule(ApplicationConfiguration $config, User $verifier): void
    {
        $schedule = ClaimingSchedule::create([
            'config_id'              => $config->id,
            'location'               => 'Barangay Mamatid Hall',
            'morning_start'          => '08:00',
            'morning_end'            => '12:00',
            'afternoon_start'        => '13:00',
            'afternoon_end'          => '17:00',
            'is_active'              => false,
            'late_claiming_date'     => '2026-09-30',
            'late_claiming_end_date' => '2026-10-09',
        ]);

        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 20,
            'batch'                => 'morning',
            'claiming_date'        => '2026-09-28',
            'verifier_id'          => $verifier->id,
        ]);

        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane B',
            'capacity'             => 20,
            'batch'                => 'afternoon',
            'claiming_date'        => '2026-09-28',
            'verifier_id'          => null,
        ]);

        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane C',
            'capacity'             => 15,
            'batch'                => 'morning',
            'claiming_date'        => '2026-09-29',
            'verifier_id'          => null,
        ]);
    }
}
