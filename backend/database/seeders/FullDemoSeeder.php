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

        // ── Historical Period 1: 2022-2023, completed, smaller program.
        //    No waitlist data — the system didn't exist yet, so unmet
        //    demand from this period was never observed. ──
        $config2022 = ApplicationConfiguration::create([
            'school_year'  => '2022-2023',
            'open_date'    => now()->subYears(4)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYears(4)->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 80,
            'slots_filled' => 62,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedHistoricalPeriod($config2022, approvedCount: 62, totalCount: 78, withClaiming: true);

        // ── Historical Period 2: 2023-2024, completed, growing ──
        $config2023 = ApplicationConfiguration::create([
            'school_year'  => '2023-2024',
            'open_date'    => now()->subYears(3)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYears(3)->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 100,
            'slots_filled' => 78,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedHistoricalPeriod($config2023, approvedCount: 78, totalCount: 95, withClaiming: true);

        // ── Historical Period 3: 2024-2025, completed, still growing ──
        $config2024 = ApplicationConfiguration::create([
            'school_year'  => '2024-2025',
            'open_date'    => now()->subYears(2)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYears(2)->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 120,
            'slots_filled' => 95,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedHistoricalPeriod($config2024, approvedCount: 95, totalCount: 140, withClaiming: true);

        // ── Historical Period 4: 2025-2026, completed — the most recent
        //    completed cycle, fills the gap so 2022→2026 is continuous
        //    with no skipped year before the active period. Still no
        //    waitlist data, same reason as the periods above. ──
        $config2025 = ApplicationConfiguration::create([
            'school_year'  => '2025-2026',
            'open_date'    => now()->subYears(1)->setMonth(7)->setDay(1)->startOfDay(),
            'close_date'   => now()->subYears(1)->setMonth(7)->setDay(31)->endOfDay(),
            'slot_limit'   => 140,
            'slots_filled' => 112,
            'is_unlimited' => false,
            'is_active'    => false,
            'created_by'   => $admin->id,
        ]);
        $this->seedHistoricalPeriod($config2025, approvedCount: 112, totalCount: 160, withClaiming: true);

        // ── Active Period: 2026-2027, currently open, at capacity — the
        //    ONLY period with waitlist data. This is intentional: unmet
        //    demand was invisible to SK before this system existed, so
        //    every period above correctly shows 0 waitlisted, not because
        //    demand didn't exist then, but because there was no way to
        //    observe it. This period is where that visibility begins. ──
        $configActive = ApplicationConfiguration::create([
            'school_year'  => '2026-2027',
            'open_date'    => now()->subDays(10)->startOfDay(),
            'close_date'   => now()->addDays(4)->endOfDay(),
            'slot_limit'   => 150,
            'slots_filled' => 149,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);
        $this->seedApprovedApplicants($configActive, 150);
        $this->seedMixedStatusApplications($configActive);
        $this->seedWaitlistedApplicants($configActive, 6);

        $schedule = $this->seedClaimingSchedule($configActive);

        // Assign EVERY approved applicant across the schedule's real
        // lanes/dates, matching what AdminScheduleController::publish()
        // actually does. Split across lanes (not one giant lane) so the
        // new lane-filter dropdown in VerifierClaiming.jsx has real
        // demo material — different lanes genuinely show different
        // applicants, same as the intended feature.
        $this->seedAllClaimingAssignments($configActive, $schedule);

        // Only not_cleared frees a slot for waitlist promotion — confirmed
        // business rule. unclaimed does NOT decrement slots_filled. Both
        // UPDATE the existing assignments created above.
        $this->applyNotClearedOutcomes($configActive, 6, startingAt: 0);
        $this->applyRetryingOutcomes($configActive, 5, startingAt: 6);

        // One already-promoted applicant, seeded directly so the "Grace
        // Period" badge and Grace Period Claiming List have something to
        // show without requiring a manual promote click first.
        $this->seedOnePromotedApplicant($configActive, $schedule);

        $this->command->info('FullDemoSeeder complete: 4 completed periods (2022–2026, growing trend, full claiming variety, zero waitlist data by design) + 1 active period (2026-2027) — the only period with waitlist/unmet-demand data, 150 approved applicants split across multiple lanes/dates, 6 not_cleared, 5 retrying (grace_period_retry, reassigned to the flex lane), grace period, and one pre-promoted applicant.');
    }

    private function seedHistoricalPeriod(ApplicationConfiguration $config, int $approvedCount, int $totalCount, bool $withClaiming): void
    {
        $rejectedCount = (int) round(($totalCount - $approvedCount) * 0.7);
        $staleCount    = $totalCount - $approvedCount - $rejectedCount;

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
                'submitted_at'      => $config->open_date->copy()->addDays(rand(0, 20)),
            ]);
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
            $this->seedHistoricalClaiming($config, $approvedApps);
        }
    }

    /**
     * FIXED (this session): schedule now sets a real grace_period_date /
     * grace_period_end_date, both fully in the past — since this whole
     * config closed years ago, there's no reason not to. Without these,
     * any 'unclaimed' row written below would be in the same ambiguous
     * state flagged as a gap in the active-period seeder: per this
     * session's rule, 'unclaimed' can only be legitimate once a real,
     * concluded grace period actually happened. Also stopped setting
     * verified_by/verified_at on 'unclaimed' rows — in the real system,
     * SweepUnclaimedAssignments finalizes a no-show automatically and
     * never sets those fields (no verifier performed an action); only
     * claimed/not_cleared are genuine verifier actions that should carry
     * them.
     */
    private function seedHistoricalClaiming(ApplicationConfiguration $config, array $approvedApps): void
    {
        $laneDate = $config->close_date->copy()->addDays(10);
        $gracePeriodStart = $laneDate->copy()->addDays(3);
        $gracePeriodEnd = $gracePeriodStart->copy()->addDays(5);

        $schedule = ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Mamatid Covered Court',
            'is_published'          => true,
            'published_at'          => $config->close_date->copy()->addDays(5),
            'grace_period_date'     => $gracePeriodStart->toDateString(),
            'grace_period_end_date' => $gracePeriodEnd->toDateString(),
        ]);
        $lane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => count($approvedApps) + 10,
            'batch'                => 'morning',
            'claiming_date'        => $laneDate->toDateString(),
        ]);

        foreach ($approvedApps as $app) {
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

            $isVerifierAction = in_array($status, ['claimed', 'not_cleared']);

            ClaimingAssignment::create([
                'application_id'       => $app->id,
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => $status,
                'source'               => 'original',
                'reason_categories'    => $reasonCategories,
                // Only claimed/not_cleared are real verifier actions.
                // 'unclaimed' is finalized automatically by the sweep,
                // which never sets these — leaving them null here matches
                // that.
                'verified_by'          => $isVerifierAction ? $this->verifier->id : null,
                'verified_at'          => $isVerifierAction ? $lane->claiming_date : null,
            ]);
            $app->update(['status' => $status]);
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
                'submitted_at'      => now()->subDays(rand(1, 9)),
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
                    'submitted_at'      => now()->subDays(rand(0, 10)),
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
        $times = [
            now()->subDays(3),
            now()->subDays(2)->subHours(5),
            now()->subDays(1),
            now()->subHours(8),
            now()->subHours(3),
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

    /**
     * Creates a schedule with THREE real lanes across TWO claiming dates.
     * Capacities (60 + 60 + 40 = 160) deliberately cover all 150 approved
     * applicants with fixed, sequential ranges — matching how real
     * scheduling actually works (AdminScheduleController::partitionApplicants()
     * fills each lane in order by capacity, not round-robin). This means
     * Lane A gets control numbers 0001–0060, Lane B gets 0061–0120, Lane C
     * gets the remaining 0121–0150 — a real, demonstrable range per lane
     * for the lane-filter dropdown.
     */
    private function seedClaimingSchedule(ApplicationConfiguration $config): ClaimingSchedule
    {
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
            'capacity'             => 60,
            'batch'                => 'morning',
            'claiming_date'        => now()->subDays(2)->toDateString(),
        ]);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane B',
            'capacity'             => 60,
            'batch'                => 'afternoon',
            'claiming_date'        => now()->subDays(2)->toDateString(),
        ]);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane C',
            'capacity'             => 40,
            'batch'                => 'morning',
            'claiming_date'        => now()->subDays(1)->toDateString(),
        ]);

        return $schedule;
    }

    /**
     * Assigns every approved applicant to a lane SEQUENTIALLY by control
     * number, filling each lane to its capacity before moving to the
     * next — exactly matching AdminScheduleController::partitionApplicants(),
     * which does the same thing for real published schedules (fixed-
     * capacity lanes get spliced off the front of the ordered applicant
     * list, in order). This is NOT round-robin — Lane A gets the first
     * batch of control numbers, Lane B the next batch, etc., so the demo
     * data actually reflects how a real claiming day is organized.
     */
    private function seedAllClaimingAssignments(ApplicationConfiguration $config, ClaimingSchedule $schedule): void
    {
        $lanes = $schedule->lanes()->orderBy('claiming_date')->orderBy('id')->get();
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

        // Safety net matching partitionApplicants()'s own overflow
        // handling: if total lane capacity somehow fell short (it doesn't
        // here — 160 covers all 150 — but this mirrors the real method's
        // guard so nobody is silently dropped from the demo data either).
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

    private function applyNotClearedOutcomes(ApplicationConfiguration $config, int $count, int $startingAt): void
    {
        $targets = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->orderBy('id')
            ->skip($startingAt)
            ->take($count)
            ->get();

        foreach ($targets as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claim_status'      => 'not_cleared',
                'reason_categories' => collect($this->notClearedReasons)->random(1)->values()->all(),
                'verified_by'       => $this->verifier->id,
                'verified_at'       => now()->subDays(1),
            ]);
            $app->update(['status' => 'not_cleared']);
        }

        $config->decrement('slots_filled', $targets->count());
    }

    /**
     * RENAMED (this session, was applyUnclaimedOutcomes) — the old name
     * was misleading after an earlier fix in this same session changed
     * what this method actually produces. These 5 applicants missed
     * their original claiming lane and are genuinely RETRYING —
     * reassigned onto the flex grace-period lane, exactly the shape
     * SweepUnclaimedAssignments::handle() itself produces for a real
     * no-show while grace period is still open. NOT 'unclaimed' — per
     * the sweep's own logic, 'original'+'unclaimed' can only legitimately
     * exist once grace_period_end_date has fully passed, which this
     * active config's schedule (grace period starts NEXT WEEK) never
     * reaches.
     */
    private function applyRetryingOutcomes(ApplicationConfiguration $config, int $count, int $startingAt): void
    {
        $schedule = ClaimingSchedule::where('config_id', $config->id)->latest()->first();
        if (!$schedule || !$schedule->grace_period_date) {
            return;
        }

        $graceLane = ClaimingLane::firstOrCreate(
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

        $targets = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->orderBy('id')
            ->skip($startingAt)
            ->take($count)
            ->get();

        foreach ($targets as $app) {
            ClaimingAssignment::where('application_id', $app->id)->update([
                'claiming_lane_id' => $graceLane->id,
                'claim_status'     => 'pending_claiming',
                'source'           => 'grace_period_retry',
            ]);
            // Application.status stays 'approved' — matches real
            // SweepUnclaimedAssignments behavior, which never touches
            // Application.status when reassigning to a retry (only
            // updateClaimStatus() syncs app.status, and only for the
            // final claimed/not_cleared outcomes).
        }
    }

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
            'submitted_at'      => now()->subDays(5),
            'waitlisted_at'     => now()->subDays(5),
        ]);

        // Mirrors what tryApprove() would do for a real promotion — this
        // applicant is hand-created at status: 'approved' rather than
        // going through the real promotion flow, so slots_filled must be
        // incremented here explicitly to keep funded-count and
        // slots_filled consistent with each other.
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
            'password'          => Hash::make('applicant123'),
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