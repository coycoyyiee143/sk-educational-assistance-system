<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds a scenario for exercising the Verifier Dashboard / Application List
 * FCFS queue: a spread of applicants with deliberately staggered
 * submitted_at timestamps (days/hours/minutes/seconds apart) so the queue
 * ordering (submitted_at asc) and the RelativeTime / "Queue #" columns can
 * be checked by eye.
 *
 * WHAT TO LOOK FOR:
 *  - "Applications Requiring Attention" (Dashboard) and the Application
 *    List's "For Review" tab should list the for_review applicants
 *    OLDEST FIRST: Santos, Dela Cruz, Reyes, Garcia, Mendoza, Torres — in
 *    that order — regardless of insertion order here.
 *  - Torres (reupload_requested) and Bautista (auto_reupload_requested)
 *    prove a reupload cycle does NOT reset queue position: Torres/Bautista
 *    keep their original (early) submitted_at even though their status
 *    briefly leaves for_review.
 *  - Reyes and Garcia are only minutes/seconds apart — good for checking
 *    the "just now" / "Xm ago" boundary and that same-day ordering is
 *    still correct to the minute.
 *  - Fernandez (pending_prescreening) and Ramos (draft_incomplete, no
 *    documents) exercise the "Pending" stat card — Ramos has no documents
 *    so it must NOT count (whereHas('documents') should exclude it).
 *  - Villanueva (approved) and Torres... wait, reused name avoided below —
 *    see per-applicant comments for exact status/stat coverage.
 */
class VerifierDashboardTestSeeder extends Seeder
{
    public function run(): void
    {
        // Uses whatever admin/verifier accounts and active application
        // period already exist — deliberately does NOT create its own
        // config. Only one config should ever have is_active = true;
        // seeding a second one here previously caused
        // ApplicationConfiguration::where('is_active', true)->first() to
        // resolve unpredictably elsewhere in the app.
        $config = ApplicationConfiguration::where('is_active', true)->first();

        if (!$config) {
            $this->command->error('No active ApplicationConfiguration found. Activate an application period first, then re-run this seeder.');
            return;
        }

        $makeApplicant = function (
            string $emailSlug,
            string $firstName,
            string $lastName,
            string $status,
            $submittedAt,
            bool $withDocuments = true,
            array $extra = []
        ) use ($config) {
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

            $app = Application::updateOrCreate(
                ['user_id' => $user->id, 'config_id' => $config->id],
                array_merge(
                    [
                        'school_name'       => 'Laguna State Polytechnic University',
                        'course'            => 'BS Information Technology',
                        'year_level'        => '3rd Year',
                        'student_id_number' => '2023-' . str_pad((string) $user->id, 5, '0', STR_PAD_LEFT),
                        'status'            => $status,
                        'submitted_at'      => $submittedAt,
                    ],
                    $extra
                )
            );

            if ($withDocuments) {
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
            }

            return $app;
        };

        // ── "for_review" queue — this is the FCFS set to eyeball ────────
        // Staggered from oldest to newest; the UI must render them in
        // this same order (oldest at the top).
        $makeApplicant('queue-santos', 'Maria', 'Santos', 'for_review', now()->subDays(3));
        $makeApplicant('queue-delacruz', 'Juan', 'Dela Cruz', 'for_review', now()->subDay());
        $makeApplicant('queue-reyes', 'Ana', 'Reyes', 'for_review', now()->subHours(5));
        // Garcia and Mendoza are only minutes/seconds apart — checks
        // same-day, near-simultaneous ordering and the "Xm ago" /
        // "just now" boundary in RelativeTime.
        $makeApplicant('queue-garcia', 'Carlos', 'Garcia', 'for_review', now()->subMinutes(45));
        $makeApplicant('queue-mendoza', 'Liza', 'Mendoza', 'for_review', now()->subMinutes(3));

        // ── Reupload cycle applicants — must KEEP their early queue
        // position even though status currently isn't for_review. Both
        // submitted earlier than Santos, so once their status returns to
        // for_review they should reappear at the very top.
        $makeApplicant(
            'queue-torres',
            'Miguel',
            'Torres',
            'reupload_requested',
            now()->subDays(4)
        );
        $makeApplicant(
            'queue-bautista',
            'Elena',
            'Bautista',
            'auto_reupload_requested',
            now()->subDays(5)
        );

        // ── Other statuses — round out the stat cards / "All" tab ──────
        $makeApplicant('queue-fernandez', 'Rosa', 'Fernandez', 'pending_prescreening', now()->subHours(2));

        $villanueva = $makeApplicant('queue-villanueva', 'Pedro', 'Villanueva', 'approved', now()->subDays(8));
        $villanueva->update([
            'control_number' => 'SK-TEST-' . now()->format('Y') . '-' . str_pad((string) $villanueva->id, 4, '0', STR_PAD_LEFT),
        ]);

        $makeApplicant('queue-mercado', 'Grace', 'Mercado', 'rejected', now()->subDays(6), true, [
            'rejection_reason' => 'Voter\'s certificate illegible.',
        ]);

        // No documents at all yet — must be EXCLUDED from every verifier
        // list/stat (whereHas('documents') should filter it out).
        $makeApplicant('queue-ramos', 'Diego', 'Ramos', 'draft_incomplete', null, false);

        // ── Dashboard banners — the two alerts on Verifier Dashboard that
        // sit outside the FCFS queue entirely (see VerifierController::stats()
        // and the "appeal_requested"/"failed_ocr" counts) ──────────────────
        $delrosario = $makeApplicant('queue-delrosario', 'Carmela', 'Del Rosario', 'appeal_requested', now()->subDays(2), true, [
            'rejection_reason' => 'School ID photo was blurry.',
            'appeal_reason'    => 'Re-uploaded a clearer photo of my school ID — please take another look.',
            'appealed_at'      => now()->subHours(6),
        ]);
        $this->command->info("Del Rosario (#{$delrosario->id}) = appeal_requested → drives the amber 'pending appeal' dashboard banner.");

        $ocrFailApp = $makeApplicant('queue-ocrfail', 'Nathaniel', 'Cruz', 'for_review', now()->subHours(1));
        ApplicationDocument::where('application_id', $ocrFailApp->id)
            ->where('document_type', 'voters_certificate')
            ->update(['status' => 'failed']);
        $this->command->info("Cruz (#{$ocrFailApp->id}) has a failed voters_certificate document → drives the red 'OCR failed' dashboard banner and the OCR Failed tab/badge.");

        $this->command->info("VerifierDashboardTestSeeder done, seeded into config #{$config->id} ({$config->school_year}). Log in with your existing verifier account.");
        $this->command->info('For-review FCFS order (oldest first): Santos, Dela Cruz, Reyes, Garcia, Mendoza.');
        $this->command->info('Torres (reupload_requested, day -4) and Bautista (auto_reupload_requested, day -5) prove a reupload does not reset queue position — should outrank everyone above once back in for_review.');
        $this->command->info('Fernandez = pending stat, Villanueva = approved, Mercado = rejected, Ramos = no documents (must not appear anywhere).');
    }
}
