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
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds a full VerifierClaiming.jsx UI test scenario, covering the two
 * tabs side by side:
 *
 * REGULAR CLAIMING should show:
 *   - Resolved history from BEFORE grace period started (Ana, Lane A,
 *     verified the same day as her lane's claiming_date)
 *
 * GRACE PERIOD LIST should show:
 *   - Retrying, unresolved (Maria/Juan/Carlos/Liza/Pedro — original,
 *     lane day passed, no action taken yet)
 *   - Retrying, already reassigned by the sweep (Miguel — grace_period_retry)
 *   - Retrying, resolved DURING grace period (Elena — original source,
 *     but verified_at falls on/after grace_period_date)
 *   - Promoted, unresolved (Rosa — waitlist_promotion, still pending)
 *   - Promoted, resolved (Diego — waitlist_promotion, already claimed)
 *   - Genuinely terminal Unclaimed (Fernando — in a SEPARATE, already-
 *     finished period, since 'unclaimed' can only be legitimate once
 *     grace period has actually ended; it can't coexist with an open
 *     grace period on the same schedule)
 *
 * DELIBERATELY NOT INCLUDED: a "still genuinely pending, not yet
 * overdue" regular lane example (previously "Lane C" / Ramon, now
 * removed). This is IMPOSSIBLE to demonstrate on the same schedule as
 * the grace period examples above, per the core sequencing rule: every
 * regular lane's claiming_date must be scheduled BEFORE grace_period_date.
 * Once grace period is open (as it is throughout this scenario), every
 * regular lane's date is, by definition, already in the past — there is
 * no valid moment where grace period is open AND a regular lane is
 * still upcoming. Trying to seed both in one schedule produces a state
 * the real app can never reach (this was an actual mistake in an
 * earlier version of this seeder — Lane C dated the same day grace
 * period started).
 *
 * To see the "still pending, not yet overdue" case instead, seed a
 * SEPARATE, standalone scenario where grace_period_date is pushed into
 * the future (e.g. +5 days) and skip creating any grace-period-pool
 * applicants (Pedro/Miguel/Rosa/etc.) entirely — that schedule's Grace
 * Period tab will legitimately be empty, which is itself correct: grace
 * period genuinely hasn't started yet.
 *
 * Not for testing the mandatory face-verification gate specifically —
 * these are fabricated accounts with no real FaceVerification embedding.
 * See ClaimingFaceTestSeeder for that (needs a REAL registered account,
 * since face verification is atomic with signup). Regular claiming here
 * still works fine for these applicants since face verification is
 * OPTIONAL there; attempting "Claimed" on a grace period row will
 * correctly hit the mandatory-gate rejection, which IS testable here —
 * just not passing it.
 */
class VerifierClaimingUiTestSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
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

        $verifier = User::firstOrCreate(
            ['email' => 'verifier@skmamatid.com'],
            [
                'first_name'        => 'SK Verifier',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09876543210',
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        // ── ACTIVE period (current, open grace period) ────────────────
        $config = ApplicationConfiguration::firstOrCreate(
            ['school_year' => '2025-2026-uitest'],
            [
                'open_date'          => now()->subDays(20)->startOfDay(),
                'close_date'         => now()->subDays(6)->endOfDay(),
                'slot_limit'         => 2000,
                'slots_filled'       => 9,
                'assistance_amount'  => 5000,
                'is_unlimited'       => false,
                'is_active'          => true,
                'created_by'         => $admin->id,
            ]
        );

        $schedule = ClaimingSchedule::firstOrCreate(
            ['config_id' => $config->id],
            [
                'location'              => 'Barangay Mamatid Covered Court',
                'is_published'          => true,
                'published_at'          => now()->subDays(7),
                'grace_period_date'     => now()->toDateString(),
                'grace_period_end_date' => now()->addDays(5)->toDateString(),
            ]
        );

        // Both lanes are dated BEFORE grace_period_date, correctly
        // respecting the sequencing rule — nothing here is dated today
        // or later, since grace period is already open.
        $laneA = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $schedule->id, 'lane_name' => 'Lane A'],
            ['capacity' => 50, 'batch' => 'morning', 'claiming_date' => now()->subDay()->toDateString()]
        );
        $laneB = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $schedule->id, 'lane_name' => 'Lane B'],
            ['capacity' => 50, 'batch' => 'afternoon', 'claiming_date' => now()->subDay()->toDateString()]
        );

        $laneA->update(['verifier_id' => $verifier->id]);

        $graceLane = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $schedule->id, 'lane_name' => 'Grace Period Claiming'],
            ['capacity' => null, 'batch' => 'morning', 'claiming_date' => $schedule->grace_period_date]
        );

        // ── Applicant scaffolding helper (usable across any config) ────
        $makeApplicant = function (string $emailSlug, string $firstName, string $lastName, ApplicationConfiguration $forConfig) {
            $user = User::firstOrCreate(
                ['email' => "{$emailSlug}@uitest.com"],
                [
                    'first_name'        => $firstName,
                    'middle_name'       => 'UITest',
                    'last_name'         => $lastName,
                    'mobile_number'     => '09' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
                    'password'          => Hash::make('applicant123'),
                    'role'              => 'applicant',
                    'is_active'         => true,
                    'email_verified_at' => now(),
                ]
            );

            StudentProfile::firstOrCreate(
                ['user_id' => $user->id],
                ['birthdate' => now()->subYears(20)->subDays(45), 'barangay' => 'Mamatid', 'is_profile_complete' => true]
            );

            $controlNumber = 'SK-' . now()->format('Y') . '-' . str_pad((string) $user->id, 4, '0', STR_PAD_LEFT);

            $app = Application::firstOrCreate(
                ['user_id' => $user->id, 'config_id' => $forConfig->id],
                [
                    'school_name'       => 'Laguna State Polytechnic University',
                    'course'            => 'BS Information Technology',
                    'year_level'        => '3rd Year',
                    'student_id_number' => '2023-' . str_pad((string) $user->id, 5, '0', STR_PAD_LEFT),
                    'status'            => 'approved',
                    'control_number'    => $controlNumber,
                    'submitted_at'      => now()->subDays(10),
                ]
            );

            foreach (['registration_form', 'school_id', 'voters_certificate'] as $docType) {
                ApplicationDocument::firstOrCreate(
                    ['application_id' => $app->id, 'document_type' => $docType],
                    [
                        'file_path' => "documents/{$app->id}/seeded_placeholder_{$docType}.jpg",
                        'file_name' => "seeded_placeholder_{$docType}.jpg",
                        'mime_type' => 'image/jpeg',
                        'version'   => 1,
                        'status'    => 'processed',
                    ]
                );
            }

            return $app;
        };

        // ── Lane A: overdue, unresolved (should move to Grace Period) ──
        $a1 = $makeApplicant('lanea-pending1', 'Maria', 'Santos', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $a1->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $laneA->id, 'claim_status' => 'pending_claiming', 'source' => 'original']
        );

        $a2 = $makeApplicant('lanea-pending2', 'Juan', 'Dela Cruz', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $a2->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $laneA->id, 'claim_status' => 'pending_claiming', 'source' => 'original']
        );

        // Ana: resolved BEFORE grace period started (verified_at matches
        // her lane's claiming_date, yesterday) — this is the genuine
        // "stays in Regular as history" case.
        $a3 = $makeApplicant('lanea-claimed', 'Ana', 'Reyes', $config);
        $a3->update(['status' => 'claimed']);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $a3->id],
            [
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $laneA->id,
                'claim_status'         => 'claimed',
                'source'               => 'original',
                'amount'               => 5000,
                'verified_by'          => $verifier->id,
                'verified_at'          => now()->subDay(), // same day as Lane A's claiming_date
            ]
        );

        // ── Lane B: overdue, unresolved (should also move to Grace Period) ──
        $b1 = $makeApplicant('laneb-pending1', 'Carlos', 'Garcia', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $b1->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $laneB->id, 'claim_status' => 'pending_claiming', 'source' => 'original']
        );

        $b2 = $makeApplicant('laneb-pending2', 'Liza', 'Mendoza', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $b2->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $laneB->id, 'claim_status' => 'pending_claiming', 'source' => 'original']
        );

        // ── Grace period: RETRYING, unresolved ──────────────────────────
        // Original no-show whose lane day has passed — surfaced
        // immediately without waiting on the sweep (see
        // applyGracePeriodEligibleCondition()'s comment for why).
        $g1 = $makeApplicant('grace-noshow', 'Pedro', 'Villanueva', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g1->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $laneA->id, 'claim_status' => 'pending_claiming', 'source' => 'original']
        );

        // Already reassigned by the sweep — also "Retrying".
        $g3 = $makeApplicant('grace-retry', 'Miguel', 'Torres', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g3->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $graceLane->id, 'claim_status' => 'pending_claiming', 'source' => 'grace_period_retry']
        );

        // ── Grace period: RETRYING, resolved DURING grace period ────────
        // Source stays 'original' (never swept — walked in and got
        // resolved before the hourly sweep ever ran), but verified_at
        // falls on/after grace_period_date, so this correctly stays
        // visible in Grace Period as history, not bounced back to
        // Regular.
        $g4 = $makeApplicant('grace-retry-resolved', 'Elena', 'Bautista', $config);
        $g4->update(['status' => 'claimed']);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g4->id],
            [
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $laneA->id,
                'claim_status'         => 'claimed',
                'source'               => 'original',
                'amount'               => 5000,
                'verified_by'          => $verifier->id,
                'verified_at'          => now(), // today, on/after grace_period_date
            ]
        );

        // ── Grace period: PROMOTED, unresolved ──────────────────────────
        $g2 = $makeApplicant('grace-promoted', 'Rosa', 'Fernandez', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g2->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $graceLane->id, 'claim_status' => 'pending_claiming', 'source' => 'waitlist_promotion']
        );

        // ── Grace period: PROMOTED, resolved ────────────────────────────
        $g5 = $makeApplicant('grace-promoted-resolved', 'Diego', 'Ramos', $config);
        $g5->update(['status' => 'claimed']);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g5->id],
            [
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $graceLane->id,
                'claim_status'         => 'claimed',
                'source'               => 'waitlist_promotion',
                'amount'               => 5000,
                'verified_by'          => $verifier->id,
                'verified_at'          => now(),
            ]
        );

        // ── SEPARATE, ALREADY-FINISHED period — for a genuine terminal
        // Unclaimed example. 'unclaimed' can only legitimately exist once
        // grace period has actually ended (that's the whole point of the
        // sweep bug we fixed earlier) — it can't coexist with an open
        // grace period on the SAME schedule, so this needs its own,
        // already-concluded period entirely.
        $pastConfig = ApplicationConfiguration::firstOrCreate(
            ['school_year' => '2024-2025-uitest-past'],
            [
                'open_date'          => now()->subDays(90)->startOfDay(),
                'close_date'         => now()->subDays(70)->endOfDay(),
                'slot_limit'         => 500,
                'slots_filled'       => 1,
                'assistance_amount'  => 5000,
                'is_unlimited'       => false,
                'is_active'          => false,
                'created_by'         => $admin->id,
            ]
        );

        $pastSchedule = ClaimingSchedule::firstOrCreate(
            ['config_id' => $pastConfig->id],
            [
                'location'              => 'Barangay Mamatid Covered Court',
                'is_published'          => true,
                'published_at'          => now()->subDays(65),
                'grace_period_date'     => now()->subDays(60)->toDateString(),
                'grace_period_end_date' => now()->subDays(55)->toDateString(), // ended 55 days ago — genuinely over
            ]
        );

        $pastLane = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $pastSchedule->id, 'lane_name' => 'Lane A'],
            ['capacity' => 50, 'batch' => 'morning', 'claiming_date' => now()->subDays(62)->toDateString()]
        );

        $fernando = $makeApplicant('past-unclaimed', 'Fernando', 'Aquino', $pastConfig);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $fernando->id],
            ['claiming_schedule_id' => $pastSchedule->id, 'claiming_lane_id' => $pastLane->id, 'claim_status' => 'unclaimed', 'source' => 'original']
        );

        $this->command->info('VerifierClaimingUiTestSeeder done. Log in as verifier@skmamatid.com / verifier123.');
        $this->command->info('--- Regular Claiming ---');
        $this->command->info('Lane A (assigned to you): Maria + Juan pending — WILL move to Grace Period (overdue).');
        $this->command->info('Lane A also: Ana — CLAIMED, stays here as history (resolved before grace period).');
        $this->command->info('Lane B: Carlos + Liza pending — WILL move to Grace Period (overdue).');
        $this->command->info('--- Grace Period List ---');
        $this->command->info('Retrying, unresolved: Pedro (original, unswept), Miguel (grace_period_retry).');
        $this->command->info('Retrying, resolved: Elena — CLAIMED during grace period, stays here as history.');
        $this->command->info('Promoted, unresolved: Rosa (waitlist_promotion).');
        $this->command->info('Promoted, resolved: Diego — CLAIMED, stays here as history.');
        $this->command->info('Fernando (past, closed period): genuinely UNCLAIMED — note: searchClaiming() does not scope by config_id, so this shows up in the current Grace Period list regardless of the active period, a pre-existing behavior worth being aware of.');
        $this->command->info('NOTE: "still pending, not yet overdue" regular claiming is NOT demonstrated here — see class docblock for why it cannot coexist with an already-open grace period.');
    }
}