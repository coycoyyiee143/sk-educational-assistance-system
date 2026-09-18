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
 *   - Resolved history from BEFORE Late Claiming started (Ana, Lane A,
 *     verified the same day as her lane's claiming_date)
 *
 * LATE CLAIMING LIST should show:
 *   - Retrying, unresolved (Maria/Juan/Carlos/Liza/Pedro — original,
 *     lane day passed, no action taken yet)
 *   - Retrying, already reassigned by the sweep (Miguel — late_claiming_retry)
 *   - Retrying, resolved DURING Late Claiming (Elena — original source,
 *     but verified_at falls on/after late_claiming_date)
 *   - Promoted, unresolved (Rosa — waitlist_promotion, still pending)
 *   - Promoted, resolved (Diego — waitlist_promotion, already claimed)
 *
 * NOT INCLUDED: a genuinely terminal Unclaimed example. 'unclaimed' can
 * only legitimately exist once Late Claiming has actually ended, which
 * means it'd need its own separate, already-closed config — and
 * searchClaiming() now scopes by the ACTIVE config_id only, so a
 * closed-period example wouldn't appear in this scenario's Late Claiming
 * List anyway. Not worth seeding here; see ClaimingFaceTestSeeder or a
 * standalone scenario if this case needs covering later.
 *
 * DELIBERATELY NOT INCLUDED: a "still genuinely pending, not yet
 * overdue" regular lane example (previously "Lane C" / Ramon, now
 * removed). This is IMPOSSIBLE to demonstrate on the same schedule as
 * the Late Claiming examples above, per the core sequencing rule: every
 * regular lane's claiming_date must be scheduled BEFORE late_claiming_date.
 * Once Late Claiming is open (as it is throughout this scenario), every
 * regular lane's date is, by definition, already in the past — there is
 * no valid moment where Late Claiming is open AND a regular lane is
 * still upcoming. Trying to seed both in one schedule produces a state
 * the real app can never reach (this was an actual mistake in an
 * earlier version of this seeder — Lane C dated the same day Late
 * Claiming started).
 *
 * To see the "still pending, not yet overdue" case instead, seed a
 * SEPARATE, standalone scenario where late_claiming_date is pushed into
 * the future (e.g. +5 days) and skip creating any Late-Claiming-pool
 * applicants (Pedro/Miguel/Rosa/etc.) entirely — that schedule's Late
 * Claiming tab will legitimately be empty, which is itself correct: Late
 * Claiming genuinely hasn't started yet.
 *
 * Not for testing the mandatory face-verification gate specifically —
 * these are fabricated accounts with no real FaceVerification embedding.
 * See ClaimingFaceTestSeeder for that (needs a REAL registered account,
 * since face verification is atomic with signup). Regular claiming here
 * still works fine for these applicants since face verification is
 * OPTIONAL there; attempting "Claimed" on a Late Claiming row will
 * correctly hit the mandatory-gate rejection, which IS testable here —
 * just not passing it.
 */
class VerifierClaimingUiTestSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::where('email', 'admin@skmamatid.com')->first();
        $verifier = User::where('email', 'verifier@skmamatid.com')->first();
        if (!$admin || !$verifier) {
            $this->command->error('Run OpeningDaySeeder first — it creates the admin/verifier accounts this seeder builds on top of.');
            return;
        }

        // ── ACTIVE period (current, open Late Claiming) ────────────────
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
                'is_active'             => true,
                'activated_at'          => now()->subDays(7),
                'late_claiming_date'     => now()->toDateString(),
                'late_claiming_end_date' => now()->addDays(5)->toDateString(),
            ]
        );

        // Both lanes are dated BEFORE late_claiming_date, correctly
        // respecting the sequencing rule — nothing here is dated today
        // or later, since Late Claiming is already open.
        $laneA = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $schedule->id, 'lane_name' => 'Lane A'],
            ['capacity' => 50, 'batch' => 'morning', 'claiming_date' => now()->subDay()->toDateString()]
        );
        $laneB = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $schedule->id, 'lane_name' => 'Lane B'],
            ['capacity' => 50, 'batch' => 'afternoon', 'claiming_date' => now()->subDay()->toDateString()]
        );

        $laneA->update(['verifier_id' => $verifier->id]);

        $lateClaimingLane = ClaimingLane::firstOrCreate(
            ['claiming_schedule_id' => $schedule->id, 'lane_name' => 'Late Claiming'],
            ['capacity' => null, 'batch' => 'morning', 'claiming_date' => $schedule->late_claiming_date]
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

        // ── Lane A: overdue, unresolved (should move to Late Claiming) ──
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

        // Ana: resolved BEFORE Late Claiming started (verified_at matches
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
                'verified_documents'   => ['registration_form', 'school_id', 'voters_certificate'],
                'verified_by'          => $verifier->id,
                'verified_at'          => now()->subDay(), // same day as Lane A's claiming_date
            ]
        );

        // ── Lane B: overdue, unresolved (should also move to Late Claiming) ──
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

        // ── Late Claiming: RETRYING, unresolved ──────────────────────────
        // Original no-show whose lane day has passed — surfaced
        // immediately without waiting on the sweep (see
        // applyLateClaimingEligibleCondition()'s comment for why).
        $g1 = $makeApplicant('late-claiming-noshow', 'Pedro', 'Villanueva', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g1->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $laneA->id, 'claim_status' => 'pending_claiming', 'source' => 'original']
        );

        // Already reassigned by the sweep — also "Retrying".
        $g3 = $makeApplicant('late-claiming-retry', 'Miguel', 'Torres', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g3->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $lateClaimingLane->id, 'claim_status' => 'pending_claiming', 'source' => 'late_claiming_retry']
        );

        // ── Late Claiming: RETRYING, resolved DURING Late Claiming ────────
        // Source stays 'original' (never swept — walked in and got
        // resolved before the hourly sweep ever ran), but verified_at
        // falls on/after late_claiming_date, so this correctly stays
        // visible in Late Claiming as history, not bounced back to
        // Regular.
        $g4 = $makeApplicant('late-claiming-retry-resolved', 'Elena', 'Bautista', $config);
        $g4->update(['status' => 'claimed']);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g4->id],
            [
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $laneA->id,
                'claim_status'         => 'claimed',
                'source'               => 'original',
                'amount'               => 5000,
                'verified_documents'   => ['registration_form', 'school_id', 'voters_certificate'],
                'verified_by'          => $verifier->id,
                'verified_at'          => now(), // today, on/after late_claiming_date
            ]
        );

        // ── Late Claiming: PROMOTED, unresolved ──────────────────────────
        $g2 = $makeApplicant('late-claiming-promoted', 'Rosa', 'Fernandez', $config);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g2->id],
            ['claiming_schedule_id' => $schedule->id, 'claiming_lane_id' => $lateClaimingLane->id, 'claim_status' => 'pending_claiming', 'source' => 'waitlist_promotion']
        );

        // ── Late Claiming: PROMOTED, resolved ────────────────────────────
        $g5 = $makeApplicant('late-claiming-promoted-resolved', 'Diego', 'Ramos', $config);
        $g5->update(['status' => 'claimed']);
        ClaimingAssignment::updateOrCreate(
            ['application_id' => $g5->id],
            [
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lateClaimingLane->id,
                'claim_status'         => 'claimed',
                'source'               => 'waitlist_promotion',
                'amount'               => 5000,
                'verified_documents'   => ['registration_form', 'school_id', 'voters_certificate'],
                'verified_by'          => $verifier->id,
                'verified_at'          => now(),
            ]
        );

        $this->command->info('VerifierClaimingUiTestSeeder done. Log in as verifier@skmamatid.com / verifier123.');
        $this->command->info('--- Regular Claiming ---');
        $this->command->info('Lane A (assigned to you): Maria + Juan pending — WILL move to Late Claiming (overdue).');
        $this->command->info('Lane A also: Ana — CLAIMED, stays here as history (resolved before Late Claiming).');
        $this->command->info('Lane B: Carlos + Liza pending — WILL move to Late Claiming (overdue).');
        $this->command->info('--- Late Claiming List ---');
        $this->command->info('Retrying, unresolved: Pedro (original, unswept), Miguel (late_claiming_retry).');
        $this->command->info('Retrying, resolved: Elena — CLAIMED during Late Claiming, stays here as history.');
        $this->command->info('Promoted, unresolved: Rosa (waitlist_promotion).');
        $this->command->info('Promoted, resolved: Diego — CLAIMED, stays here as history.');
        $this->command->info('NOTE: "still pending, not yet overdue" regular claiming is NOT demonstrated here — see class docblock for why it cannot coexist with an already-open Late Claiming.');
    }
}