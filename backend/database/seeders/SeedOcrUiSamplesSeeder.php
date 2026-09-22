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
 * DATA SOURCE: the "Objective 2 — 200-Document Evaluation Workbook"
 * (Registration Form / School ID / Voter's Certificate tabs). Every
 * applicant below is seeded with their REAL name and REAL school —
 * exactly like the already-working vc-187/188/195/197 UP-LB cases.
 * The "wrong name / wrong school / wrong year" test scenarios in the
 * workbook are baked into the scanned IMAGE itself (the photographed
 * document was edited to print a different value), not something this
 * seeder fakes on the applicant's declared profile. So we never need
 * to override name/school here — just attach whichever real scan
 * files exist for that person and let the OCR job do its job.
 *
 * BATCHING: seeding 80 applications (through OCR + PaddleOCR) back to
 * back in one run is slow and hard to review. Set OCR_BATCH (1-indexed)
 * to seed 5 applications at a time instead of the whole set:
 *
 *   php artisan db:seed --class=SeedOcrUiSamplesSeeder            # batch 1 (cases 1-5)
 *   OCR_BATCH=2 php artisan db:seed --class=SeedOcrUiSamplesSeeder # batch 2 (cases 6-10)
 *   ...
 *   OCR_BATCH=all php artisan db:seed --class=SeedOcrUiSamplesSeeder # everything in one run
 *
 * (PowerShell: `$env:OCR_BATCH=2; php artisan db:seed --class=SeedOcrUiSamplesSeeder`)
 *
 * Missing files (e.g. no School ID scans for STI/SVCC/UP-LB, no
 * VC-194) are skipped automatically — seedCase() already does a
 * file_exists() check per document and just logs "File not found,
 * skipping" instead of failing the run.
 */
class SeedOcrUiSamplesSeeder extends Seeder
{
    private const BATCH_SIZE = 5;

    /** Root folder for the real scanned test documents on this machine. */
    private const DATA_ROOT = 'C:/Users/DELL/Documents/Data testing';

    /**
     * One school per block: [folder name under DATA_ROOT, full school
     * name to declare, first case number, last case number, list of
     * [number => 'First|Middle|Last'] names]. Middle name is optional —
     * omit the '|' segment entirely for a no-middle-name applicant.
     */
    private array $schools = [
        [
            'folder' => 'PUP',
            'school' => 'Polytechnic University of the Philippines',
            'people' => [
                1 => 'Jean Gray|Batumbakal|Hemenez',
                2 => 'Marco Antonio|Gonzaga|Villanueva',
                3 => 'Beatrice Ann|Marasigan|Reyes',
                4 => 'Louise Andrea|Perez|Garcia',
                5 => 'Patrick Joshua|Molino|Cruz',
                6 => 'Janelle Kaye|Torres|De Leon',
                7 => 'Andrea Mae|Ramos|Lim',
                8 => 'Kimberly Joy|Dati|Santos',
                9 => 'Ella Mae|Cortez|Pascual',
                10 => 'Marielle Ann|Diaz|Garcia',
                11 => 'Angelica Mae|Valdez|Rivera',
                12 => 'Erika Louise|M.|Dela Cruz',
                13 => 'Trisha Nicole|Daez|Mendoza',
                14 => 'Carol|Tan|Fuentes',
                15 => 'Ela Marie|Rodrigez|Dela Rosario',
                16 => 'Danica Joy|Romualdez|Fabian',
                17 => 'Miguel Angelo|Protacio|Laureano',
                18 => 'Ian Matthew|Cabrera|David',
                19 => 'Angelica Marie|Tina|Lagmay',
                20 => 'Kyle Andrei|Baes|Marcelino',
            ],
        ],
        [
            'folder' => 'STI',
            'school' => 'STI College Calamba',
            'people' => [
                21 => 'Joshua Miguel|Reyes|Alvarez',
                22 => 'Angela Mae|Flores|Miranda',
                23 => 'Mark Joseph|Garcia|Miles',
                24 => 'Janelle Rose|Lim|Castro',
                25 => 'John Paul|Torres|Bacelonia',
                26 => 'Rose Anne|Diaz|Laforteza',
                27 => 'Carl Andrew|Lopez|Fernandez',
                28 => 'Mary Joy|Castillo|Brutas',
                29 => 'Kevin James|Ong|Samson',
                30 => 'Christine Mae|Tan|Ambat',
                31 => 'Paolo Miguel|Chua|Nicolas',
                32 => 'Jessica Anne|Co|Bautista',
                33 => 'Jerome|Louis|Baes',
                34 => 'Kate Marie|Sy|Cortez',
                35 => 'Luis Paul|Gomez|Grande',
                36 => 'Trisha Mae|Luna|Dizon',
                37 => 'Kyle Andrew|Javier|De Vera',
                38 => 'Janine Rose|Ocampo|Morales',
                39 => 'Christian John|Valencia|Serrano',
                40 => 'Aira Mae|Francisco|Rosales',
            ],
        ],
        [
            'folder' => 'SVCC',
            'school' => 'St. Vincent College of Cabuyao',
            'people' => [
                41 => 'Anthony Miguel|Santos|Del Rosario',
                42 => 'Natalia Mae|Ramos|Villanueva',
                43 => 'Peter Benjamin|Garcia|Mendoza',
                44 => 'Wanda Elise|Navarro|Salazar',
                45 => 'Clinton James|Bautista|Manalo',
                46 => 'Bruce Adrian|Castillo|Evangelista',
                47 => 'Samuel Wilson|Reyes|Macapagal',
                48 => 'Caroline Denise|Mercado|Valdez',
                49 => 'James Buchanan|Flores|Soriano',
                50 => 'Scott Miguel|Aquino|De Guzman',
                51 => 'Peter Jason|Fernandez|Pascual',
                52 => 'Theodore Luis|Morales|Magbanua',
                53 => 'Stephen Vincent|Cabrera|Tolentino',
                54 => 'Virginia Mae|Padilla|Domingo',
                55 => 'Nicholas Joseph|Rivera|Lacson',
                56 => 'Victor Elias|Alonzo|Samonte',
                57 => 'Lorenzo Gabriel|Tuazon|Delos Santos',
                58 => 'Clinton Rafael|Santiago|Marasigan',
                59 => 'Pietro Luis|Arellano|Buenaventura',
                60 => 'Sabrina Mae|Carpio|Rodrigo',
            ],
        ],
        [
            'folder' => 'UP-LB',
            'school' => 'University of the Philippines Los Baños',
            'people' => [
                181 => 'Nicole|Villaruel|Corpuz',
                182 => 'Joel|Jacinto|Morales',
                183 => 'Jhon Vincent||Villanueva',
                184 => 'Rosa Mae|Puno|Asuncion',
                185 => 'Mary Kathy|Opo|Villanueva',
                186 => 'Janice Sage|Isidro|Dayag',
                187 => 'Angillyn|Chua|Malayon',
                188 => 'Lorelaine|Pugay|Llorente',
                189 => 'Joseph|Magdayao|Lumbay',
                190 => 'Jerry|Solinap|Sibug',
                191 => 'Nicole|Lucban|Marquez',
                192 => 'Melodie Mae|Bermas|Roxas',
                193 => 'Marcus|Bautista|Somera',
                194 => 'Mark Robert||Herrera',
                195 => 'Jackson Rick|Lapaz|Paras',
                196 => 'Katarina||Cruz',
                197 => 'Gilbert|Menese|Lagman',
                198 => 'Veronica|Cruz|Ramos',
                199 => 'Colton Marc|Cabral|Paña',
                200 => 'Eliza Marie|Roa|Galang',
            ],
        ],
    ];

    public function run(): void
    {
        $allCases = $this->buildAllCases();

        $batch = env('OCR_BATCH', 1);

        if (strtolower((string) $batch) === 'all') {
            $cases = $allCases;
            $this->command->info('Seeding ALL '.count($allCases).' cases in one run.');
        } else {
            $batch = max(1, (int) $batch);
            $offset = ($batch - 1) * self::BATCH_SIZE;
            $cases = array_slice($allCases, $offset, self::BATCH_SIZE);

            if (empty($cases)) {
                $totalBatches = (int) ceil(count($allCases) / self::BATCH_SIZE);
                $this->command->error("OCR_BATCH={$batch} is out of range — there are only {$totalBatches} batches of ".self::BATCH_SIZE.' (total '.count($allCases).' cases).');
                return;
            }

            $this->command->info("Seeding batch {$batch}: ".count($cases)." case(s) (of ".count($allCases)." total, ".self::BATCH_SIZE." per batch).");
        }

        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            $this->command->error('No active ApplicationConfiguration found. Activate an application period first, then re-run this seeder.');
            return;
        }

        foreach ($cases as $case) {
            $this->seedCase($case, $config);
        }
    }

    /**
     * Flattens $schools into one ordered list of case arrays, in the
     * same shape the old hand-written $cases array used. Every doc
     * type is always listed with its expected path — seedCase()'s own
     * file_exists() check silently skips whichever ones don't exist
     * for that school/number (e.g. no School ID scans outside PUP).
     */
    private function buildAllCases(): array
    {
        $cases = [];

        foreach ($this->schools as $school) {
            foreach ($school['people'] as $number => $nameSpec) {
                [$first, $middle, $last] = array_pad(explode('|', $nameSpec), 3, '');
                $padded = str_pad((string) $number, 3, '0', STR_PAD_LEFT);

                $case = [
                    'label' => strtolower($school['folder']).'-'.$padded,
                    'first_name' => $first,
                    'last_name' => $last,
                    'declared_school' => $school['school'],
                    'school_year' => '2025-2026',
                    'documents' => [
                        'school_id' => self::DATA_ROOT."/{$school['folder']}/SID/ID-{$padded}.jpg",
                        'registration_form' => self::DATA_ROOT."/{$school['folder']}/RF/RF-{$padded}.jpg",
                        // PUP's 20th voter's certificate was scanned without
                        // a zero-padded filename (VC-20.jpg, not VC-020.jpg).
                        'voters_certificate' => ($school['folder'] === 'PUP' && $number === 20)
                            ? self::DATA_ROOT."/{$school['folder']}/VC/VC-20.jpg"
                            : self::DATA_ROOT."/{$school['folder']}/VC/VC-{$padded}.jpg",
                    ],
                ];

                if ($middle !== '') {
                    $case['middle_name'] = $middle;
                }

                $cases[] = $case;
            }
        }

        return $cases;
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
