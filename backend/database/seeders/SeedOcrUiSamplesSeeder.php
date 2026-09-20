<?php

namespace Database\Seeders;

use App\Jobs\ProcessOcrDocument;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;

/**
 * Seeds real test documents (for Capstone Objective 2 — screenshotting
 * actual verification results in the Verifier Review UI) WITHOUT going
 * through applicant registration, email verification, or the upload
 * form. "Uploading" here just means: copy the real image file into the
 * exact storage path a real upload would use, create the matching
 * ApplicationDocument row, then run the real OCR job synchronously
 * (dispatchSync — no queue worker needed) so verification_checks are
 * populated immediately.
 *
 * Log in with your EXISTING verifier account afterward and open
 * /VerifierApplicationReview/{id} for each printed application id.
 *
 * HOW TO USE:
 * Edit the $cases array below — one entry per test APPLICATION (a
 * "case" can have 1-3 documents; you don't need all three document
 * types filled in just to see one document's checks). image paths are
 * absolute local paths on YOUR machine, e.g.
 * 'C:/Users/DELL/Documents/documents/UPLB/id/ID-181.png'.
 *
 * $cases is a plain array, not a single-record slot — add as many
 * entries as you want and the seeder loops over ALL of them in one run
 * (see run() below). There's nothing special about "one seed per
 * application": if you need 200 test applications for a demo/report,
 * add 200 entries here (or generate them programmatically into this
 * array before run() executes) and run the seeder once.
 *
 * 'middle_name' is optional — omit the key entirely (not just an empty
 * string) for dummy applicants who don't have one; see the
 * 'no-middle-name' example below.
 *
 * document_type keys (matches the application_documents.document_type
 * enum — see the 2026_06_11_090704_create_application_documents_table
 * migration): 'school_id', 'registration_form', 'voters_certificate'.
 * One example of each is included below.
 *
 * 'birthdate' is optional — omit it and the case defaults to an adult
 * (20 years old). A StudentProfile is considered a minor when age < 18
 * (see StudentProfile::getIsMinorAttribute()), which is what unlocks
 * the guardian_* fields below being relevant. Pass a Carbon-parseable
 * string, e.g. '2010-05-14'.
 *
 * 'guardian' is optional — an associative array with keys
 * 'first_name', 'middle_name' (optional), 'last_name', 'relationship',
 * 'contact'. Only meaningful for minor applicants (see
 * StudentProfile::hasCompleteGuardianInfo()), but nothing stops you
 * from setting it on an adult case too. See the 'minor-with-guardian'
 * example below.
 *
 * Then run:
 *   php artisan db:seed --class=SeedOcrUiSamplesSeeder
 */
class SeedOcrUiSamplesSeeder extends Seeder
{
    private array $cases = [
        // Example: school_id document
        // [
        //     'label'           => 'uplb-correct-name',
        //     'first_name'      => 'Nicole',
        //     'middle_name'     => 'V.',
        //     'last_name'       => 'Corpuz',
        //     'declared_school' => 'University of the Philippines Los Baños',
        //     'school_year'     => '2025-2026',
        //     'documents'       => [
        //         'school_id' => 'C:/Users/DELL/Documents/documents/UPLB/id/ID-181.png',
        //     ],
        // ],

        // Example: registration_form document
        // [
        //     'label'           => 'pnc-reg-form',
        //     'first_name'      => 'Mark',
        //     'middle_name'     => 'D.',
        //     'last_name'       => 'Santos',
        //     'declared_school' => 'Pamantasan ng Cabuyao',
        //     'school_year'     => '2025-2026',
        //     'documents'       => [
        //         'registration_form' => 'C:/Users/DELL/Documents/documents/PNC/reg/REG-001.png',
        //     ],
        // ],

        // Example: voters_certificate document
        // [
        //     'label'           => 'comelec-voters-cert',
        //     'first_name'      => 'Ana',
        //     'middle_name'     => 'R.',
        //     'last_name'       => 'Reyes',
        //     'declared_school' => 'STI College Calamba',
        //     'school_year'     => '2025-2026',
        //     'documents'       => [
        //         'voters_certificate' => 'C:/Users/DELL/Documents/documents/COMELEC/cert/CERT-001.png',
        //     ],
        // ],

        // Example: applicant with no middle name — just omit the key
        // [
        //     'label'           => 'no-middle-name',
        //     'first_name'      => 'Jomar',
        //     'last_name'       => 'Dizon',
        //     'declared_school' => 'STI College Calamba',
        //     'school_year'     => '2025-2026',
        //     'documents'       => [
        //         'school_id' => 'C:/Users/DELL/Documents/documents/STI/id/ID-002.png',
        //     ],
        // ],

        // Example: one application with all 3 documents attached — a
        // single 'documents' array can hold any combination of the 3
        // document_type keys; this one has them all.
        // [
        //     'label'           => 'pnc-full-set',
        //     'first_name'      => 'Liza',
        //     'middle_name'     => 'M.',
        //     'last_name'       => 'Fernandez',
        //     'declared_school' => 'Pamantasan ng Cabuyao',
        //     'school_year'     => '2025-2026',
        //     'documents'       => [
        //         'school_id'           => 'C:/Users/DELL/Documents/documents/PNC/id/ID-050.png',
        //         'registration_form'   => 'C:/Users/DELL/Documents/documents/PNC/reg/REG-050.png',
        //         'voters_certificate'  => 'C:/Users/DELL/Documents/documents/COMELEC/cert/CERT-050.png',
        //     ],
        // ],

        // Example: minor applicant with guardian info filled in
        // [
        //     'label'           => 'minor-with-guardian',
        //     'first_name'      => 'Kyle',
        //     'last_name'       => 'Ramos',
        //     'birthdate'       => '2010-05-14',
        //     'declared_school' => 'STI College Calamba',
        //     'school_year'     => '2025-2026',
        //     'guardian'        => [
        //         'first_name'   => 'Rowena',
        //         'last_name'    => 'Ramos',
        //         'relationship' => 'Mother',
        //         'contact'      => '09171234567',
        //     ],
        //     'documents'       => [
        //         'school_id' => 'C:/Users/DELL/Documents/documents/STI/id/ID-003.png',
        //     ],
        // ],
    ];

    public function run(): void
    {
        if (empty($this->cases)) {
            $this->command->error('No cases configured — edit $cases at the top of SeedOcrUiSamplesSeeder.php first.');
            return;
        }

        // All applications share the single currently-active period —
        // the seeder doesn't support seeding into multiple config periods
        // in one run.
        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            $this->command->error('No active ApplicationConfiguration found. Activate an application period first, then re-run this seeder.');
            return;
        }

        // One application per case — loops over the whole $cases array,
        // so this scales to as many test applications as you add entries
        // for (e.g. 200), not just one per run.
        foreach ($this->cases as $case) {
            $this->seedCase($case, $config);
        }
    }

    private function seedCase(array $case, ApplicationConfiguration $config): void
    {
        $label = $case['label'];
        $emailSlug = 'ocr-sample-' . preg_replace('/[^a-z0-9]+/i', '-', $label);

        // middle_name is optional on a real applicant too — cases that
        // omit the key just get stored as an empty string, same as a
        // real applicant leaving it blank.
        $user = User::firstOrCreate(
            ['email' => "{$emailSlug}@ocrtest.local"],
            [
                'first_name'        => $case['first_name'],
                'middle_name'       => $case['middle_name'] ?? '',
                'last_name'         => $case['last_name'],
                'mobile_number'     => '09' . str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT),
                'password'          => Hash::make('ocrtest123'),
                'role'              => 'applicant',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        // 'birthdate' defaults to an adult (20yo) case if not set. 'guardian'
        // is only meaningful once birthdate makes StudentProfile::is_minor
        // true, but is stored regardless if provided.
        $guardian = $case['guardian'] ?? [];
        StudentProfile::firstOrCreate(
            ['user_id' => $user->id],
            [
                'birthdate'              => $case['birthdate'] ?? now()->subYears(20)->subDays(45),
                'barangay'               => 'Mamatid',
                'guardian_first_name'    => $guardian['first_name'] ?? null,
                'guardian_middle_name'   => $guardian['middle_name'] ?? null,
                'guardian_last_name'     => $guardian['last_name'] ?? null,
                'guardian_relationship'  => $guardian['relationship'] ?? null,
                'guardian_contact'       => $guardian['contact'] ?? null,
                'is_profile_complete'    => true,
            ]
        );

        $application = Application::updateOrCreate(
            ['user_id' => $user->id, 'config_id' => $config->id],
            [
                'school_name'       => $case['declared_school'],
                'course'            => 'BS Sample Course',
                'year_level'        => '3rd Year',
                'student_id_number' => '2023-' . str_pad((string) $user->id, 5, '0', STR_PAD_LEFT),
                'status'            => 'pending_prescreening',
                'submitted_at'      => now(),
            ]
        );

        $this->command->info("Case '{$label}': Application #{$application->id} ({$case['first_name']} {$case['last_name']})");

        // $docType is one of the application_documents.document_type enum
        // values ('school_id', 'registration_form', 'voters_certificate')
        // — a case can list 1-3 of these under 'documents'.
        foreach ($case['documents'] as $docType => $sourcePath) {
            if (!file_exists($sourcePath)) {
                $this->command->error("  [{$docType}] File not found, skipping: {$sourcePath}");
                continue;
            }

            // Same storage path shape a real upload writes to, so
            // ProcessOcrDocument below reads it exactly like production.
            $fileName = time() . '_' . basename($sourcePath);
            $storagePath = "documents/{$application->id}/{$fileName}";

            Storage::disk('local')->put($storagePath, file_get_contents($sourcePath));

            $document = ApplicationDocument::create([
                'application_id' => $application->id,
                'document_type'  => $docType,
                'file_path'      => $storagePath,
                'file_name'      => $fileName,
                'mime_type'      => mime_content_type($sourcePath) ?: 'image/jpeg',
                'version'        => 1,
                'status'         => 'processing',
            ]);

            // Same job the real upload flow dispatches to the queue —
            // dispatchSync runs it immediately, in this process, so no
            // queue worker needs to be running for this to work.
            ProcessOcrDocument::dispatchSync($application, $document, $storagePath);

            $document->refresh();
            $this->command->info("  [{$docType}] document #{$document->id} -> status: {$document->status}");
        }

        $this->command->info("  Open /VerifierApplicationReview/{$application->id} as your verifier account to view/screenshot.");
    }
}
