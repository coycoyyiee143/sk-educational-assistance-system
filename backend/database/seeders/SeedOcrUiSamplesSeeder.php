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
 * back in one run is slow, hard to review, and can blow past a tight
 * CLI memory_limit on large scanned images. Set OCR_BATCH (1-indexed)
 * to seed 3 applications at a time instead of the whole set:
 *
 *   php artisan db:seed --class=SeedOcrUiSamplesSeeder            # batch 1 (cases 1-3)
 *   OCR_BATCH=2 php artisan db:seed --class=SeedOcrUiSamplesSeeder # batch 2 (cases 4-6)
 *   ...
 *   OCR_BATCH=all php artisan db:seed --class=SeedOcrUiSamplesSeeder # everything in one run
 *
 * (PowerShell: `$env:OCR_BATCH=2; php artisan db:seed --class=SeedOcrUiSamplesSeeder`)
 *
 * If you still hit "Out of memory" (check the number in the error —
 * "allocated 41943040 bytes" means a 40MB memory_limit, well under
 * PHP's usual 128M+ default), raise it just for this run instead of
 * shrinking the batch further:
 *   php -d memory_limit=512M artisan db:seed --class=SeedOcrUiSamplesSeeder
 *
 * DOC TYPE: matches the workbook's per-document-type tabs — test a
 * subset of document types per application instead of all three.
 * Defaults to Registration Form + Voter's Certification (School ID is
 * excluded by default since only PUP has those scans). OCR_DOC_TYPE
 * takes a comma-separated list, or "all":
 *
 *   (unset)                                            # default: registration_form,voters_certificate
 *   OCR_DOC_TYPE=registration_form
 *   OCR_DOC_TYPE=school_id
 *   OCR_DOC_TYPE=voters_certificate
 *   OCR_DOC_TYPE=registration_form,school_id
 *   OCR_DOC_TYPE=all                                   # all three per application
 *
 * Missing files (e.g. no School ID scans for STI/SVCC/UP-LB, no
 * VC-194) are skipped automatically — seedCase() already does a
 * file_exists() check per document and just logs "File not found,
 * skipping" instead of failing the run.
 *
 * SCHOOL: restrict to one school's folder instead of all four.
 * OCR_SCHOOL takes the 'folder' value from $schools below (PUP, STI,
 * SVCC, or UP-LB), case-insensitive. Combine with OCR_BATCH=all to seed
 * every applicant for that school in one run, e.g. to exercise the new
 * PUP template-check strategies against all 20 PUP applicants with all
 * 3 document types:
 *
 *   OCR_SCHOOL=PUP OCR_DOC_TYPE=all OCR_BATCH=all php artisan db:seed --class=SeedOcrUiSamplesSeeder
 *
 * (PowerShell: `$env:OCR_SCHOOL='PUP'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH='all'; php artisan db:seed --class=SeedOcrUiSamplesSeeder`)
 *
 * Note: PUP's SID folder only has real School ID scans for cases 1-5
 * (ID-001.jpg through ID-005.jpg) — cases 6-20 will skip school_id
 * ("File not found") and still seed registration_form/voters_certificate.
 *
 * ONE AT A TIME: OCR_BATCH_SIZE overrides the default of 3 cases per
 * batch. Set it to 1 to seed exactly one application per command, then
 * bump OCR_BATCH for the next one:
 *
 *   $env:OCR_SCHOOL='PUP'; $env:OCR_DOC_TYPE='all'; $env:OCR_BATCH_SIZE='1'; $env:OCR_BATCH='1'; php artisan db:seed --class=SeedOcrUiSamplesSeeder
 *   $env:OCR_BATCH='2'; php artisan db:seed --class=SeedOcrUiSamplesSeeder
 *   $env:OCR_BATCH='3'; php artisan db:seed --class=SeedOcrUiSamplesSeeder
 *   ...
 *
 * ONE SPECIFIC PERSON: OCR_CASE targets an exact case number (the key
 * next to their name in $schools below, e.g. 186 for UP-LB's Janice
 * Sage Dayag) or a comma-separated list of them, regardless of batch
 * size/offset math or how many OTHER cases for that school/doc-type
 * are still unseeded. Use this instead of OCR_BATCH when you need to
 * re-seed one specific person's document (e.g. after deleting a doc
 * that hit a since-fixed bug) without touching every other still-
 * unseeded case for that school:
 *
 *   $env:OCR_SCHOOL='UP-LB'; $env:OCR_DOC_TYPE='registration_form'; $env:OCR_CASE='186'; php artisan db:seed --class=SeedOcrUiSamplesSeeder
 *   $env:OCR_CASE='186,190' ...                        # multiple specific people
 */
class SeedOcrUiSamplesSeeder extends Seeder
{
    private const BATCH_SIZE = 3;

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
            // RF/VC use a dash ("RF-041.jpg"), but the School ID scans are
            // in an "ID" (not "SID") subfolder with a space separator
            // ("ID 041.jpg") -- confirmed by inspecting the actual SVCC
            // folder.
            'id_folder' => 'ID',
            'id_separator' => ' ',
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
        [
            'folder' => 'UPHS',
            'school' => 'University of Perpetual Help System DALTA',
            // Space-separated filenames ("ID 061.jpg") and an "ID" (not
            // "SID") School ID subfolder -- confirmed by inspecting the
            // actual UPHS folder, unlike every other school above.
            'separator' => ' ',
            'id_folder' => 'ID',
            'people' => [
                61 => 'Josh Erold|Gopolla|Asi',
                62 => 'Miguel Angelo|Longasa|Santillan',
                63 => 'Lorraine Nicole|Ramos|Mendoza',
                64 => 'Danielle Sofia|Ramil|Ramirez',
                65 => 'Nathan Gabriel|Asilo|Castillo',
                66 => 'Patricia Mae|Eleonor|Dela Cruz',
                67 => 'Kianna Rose|Antido|Villareal',
                68 => 'Sean Patrick|Misa|Mercado',
                69 => 'Bianca Therese|Narag|Espinosa',
                70 => 'Andrian Louis|Curambao|Gutierrez',
                71 => 'Patricia Elaine|Borsh|Salazar',
                72 => 'Chelsea Dawn|Padilla|Yabut',
                73 => 'Ethan James|Soyangco|Velasco',
                74 => 'Aaron Blake|Salcedo|Aguilar',
                75 => 'Daniel Joseph|Tuazon|Marquez',
                76 => 'Noah|Morales|Santos',
                77 => 'Hannah Beatrice|Medina|Ortega',
                78 => 'Arianne Faith|Uy|Alonzo',
                79 => 'Janelle Marie|Salvador|Zamora',
                80 => 'Gado|Fernandez|Maderazzo',
            ],
        ],
        [
            'folder' => 'NU',
            'school' => 'National University',
            // Same UPHS-style convention: space-separated filenames
            // ("ID 101.jpg") and an "ID" (not "SID") School ID subfolder.
            'separator' => ' ',
            'id_folder' => 'ID',
            'people' => [
                101 => 'Erika Joy|Baltazar|Villamor',
                102 => 'Miguel Antonio|Padilla|Soriano',
                103 => 'Bianca Marie|Gonzales|Lacson',
                104 => 'John Patrick|Villafuerte|Regalado',
                105 => 'Danielle Faith|Ocampo|Marquez',
                106 => 'Lorenzo Gabriel|Santos|Camacho',
                107 => 'Kyla Marie|Espiritu|Baldoza',
                108 => 'Russel Andrew|Cruz|Tibayan',
                109 => 'Allyssa Nicole|Reyes|Montemayor',
                110 => 'Gian Carlo|Dimaano|Paras',
                111 => 'Mary Rose|Liwanag|Abrigo',
                112 => 'Dexter James|Abad|Sebastian',
                113 => 'Francine Mae|Toledo|Narciso',
                114 => 'Ian Carlos|Matias|Briones',
                115 => 'Jezreel Ann|Pascual|Calderon',
                116 => 'Mark Louie|Fernando|Ortiz',
                117 => 'Dyan Carla|Mendiola|Velasquez',
                118 => 'Noel Justine|Bagsic|Arellano',
                119 => 'Catherine Joy|Ramos|Espino',
                120 => 'Rico Angelo|De Leon|Buenaventura',
            ],
        ],
    ];

    public function run(): void
    {
        $allDocTypes = ['registration_form', 'school_id', 'voters_certificate'];
        $docTypeParam = env('OCR_DOC_TYPE', 'registration_form,voters_certificate');

        $docTypes = strtolower(trim($docTypeParam)) === 'all'
            ? $allDocTypes
            : array_map('trim', explode(',', $docTypeParam));

        $invalid = array_diff($docTypes, $allDocTypes);
        if (!empty($invalid)) {
            $this->command->error("OCR_DOC_TYPE has invalid value(s): ".implode(', ', $invalid).' — must be a comma-separated list from: '.implode(', ', $allDocTypes).', or "all".');
            return;
        }

        $schoolFilter = env('OCR_SCHOOL');
        $schools = $this->schools;
        if ($schoolFilter !== null) {
            $schools = array_values(array_filter(
                $schools,
                fn (array $s) => strcasecmp($s['folder'], $schoolFilter) === 0
            ));

            if (empty($schools)) {
                $validFolders = implode(', ', array_column($this->schools, 'folder'));
                $this->command->error("OCR_SCHOOL={$schoolFilter} doesn't match any school — must be one of: {$validFolders}.");
                return;
            }
        }

        $allCases = $this->buildAllCases($docTypes, $schools);

        // OCR_CASE targets exact case number(s) directly, bypassing
        // OCR_BATCH's offset math entirely -- for re-seeding one
        // specific person (e.g. after deleting a document that hit a
        // since-fixed bug) without also picking up every OTHER still-
        // unseeded case for that school/doc-type, which OCR_BATCH=all
        // would do.
        $caseFilter = env('OCR_CASE');
        if ($caseFilter !== null) {
            $wantedNumbers = array_map('trim', explode(',', (string) $caseFilter));
            $cases = array_values(array_filter(
                $allCases,
                fn (array $c) => in_array((string) $c['number'], $wantedNumbers, true)
            ));

            $foundNumbers = array_map(fn (array $c) => (string) $c['number'], $cases);
            $missingNumbers = array_diff($wantedNumbers, $foundNumbers);
            if (!empty($missingNumbers)) {
                $this->command->error(
                    'OCR_CASE has number(s) not found in the current OCR_SCHOOL selection: '
                    .implode(', ', $missingNumbers)
                );
                return;
            }

            $this->command->info('Seeding OCR_CASE-targeted case(s): '.implode(', ', $wantedNumbers));

            $config = ApplicationConfiguration::where('is_active', true)->first();
            if (!$config) {
                $this->command->error('No active ApplicationConfiguration found. Activate an application period first, then re-run this seeder.');
                return;
            }

            foreach ($cases as $case) {
                $this->seedCase($case, $config);
            }
            return;
        }

        $batchSize = max(1, (int) env('OCR_BATCH_SIZE', self::BATCH_SIZE));
        $batch = env('OCR_BATCH', 1);

        if (strtolower((string) $batch) === 'all') {
            $cases = $allCases;
            $this->command->info('Seeding ALL '.count($allCases).' cases in one run.');
        } else {
            $batch = max(1, (int) $batch);
            $offset = ($batch - 1) * $batchSize;
            $cases = array_slice($allCases, $offset, $batchSize);

            if (empty($cases)) {
                $totalBatches = (int) ceil(count($allCases) / $batchSize);
                $this->command->error("OCR_BATCH={$batch} is out of range — there are only {$totalBatches} batches of {$batchSize} (total ".count($allCases).' cases).');
                return;
            }

            $this->command->info("Seeding batch {$batch}: ".count($cases)." case(s) (of ".count($allCases)." total, {$batchSize} per batch).");
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
     * same shape the old hand-written $cases array used. Only the
     * requested $docTypes' paths are included per case — seedCase()'s
     * own file_exists() check still silently skips whichever ones
     * don't exist for that school/number (e.g. no School ID scans
     * outside PUP).
     */
    private function buildAllCases(array $docTypes, array $schools): array
    {
        $cases = [];

        foreach ($schools as $school) {
            // Per-school overrides for filename convention -- UPHS uses a
            // space instead of a dash between the doc-type prefix and the
            // number ("ID 061.jpg" not "ID-061.jpg"), and its School ID
            // folder is named "ID" rather than every other school's "SID".
            $sep = $school['separator'] ?? '-';
            $idFolder = $school['id_folder'] ?? 'SID';
            // Lets a school's School ID filenames use a different
            // separator than its RF/VC filenames (SVCC: "ID 041.jpg" vs
            // "RF-041.jpg"/"VC-041.jpg"). Defaults to $sep for every
            // other school, where all three doc types share one pattern.
            $idSep = $school['id_separator'] ?? $sep;

            foreach ($school['people'] as $number => $nameSpec) {
                [$first, $middle, $last] = array_pad(explode('|', $nameSpec), 3, '');
                $padded = str_pad((string) $number, 3, '0', STR_PAD_LEFT);

                $allDocuments = [
                    'school_id' => self::DATA_ROOT."/{$school['folder']}/{$idFolder}/ID{$idSep}{$padded}.jpg",
                    'registration_form' => self::DATA_ROOT."/{$school['folder']}/RF/RF{$sep}{$padded}.jpg",
                    // PUP's 20th voter's certificate was scanned without
                    // a zero-padded filename (VC-20.jpg, not VC-020.jpg).
                    'voters_certificate' => ($school['folder'] === 'PUP' && $number === 20)
                        ? self::DATA_ROOT."/{$school['folder']}/VC/VC-20.jpg"
                        : self::DATA_ROOT."/{$school['folder']}/VC/VC{$sep}{$padded}.jpg",
                ];

                $case = [
                    'label' => strtolower($school['folder']).'-'.$padded,
                    'number' => $number,
                    'first_name' => $first,
                    'last_name' => $last,
                    'declared_school' => $school['school'],
                    'school_year' => '2025-2026',
                    'documents' => array_intersect_key($allDocuments, array_flip($docTypes)),
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

            // Re-running the same case/batch (e.g. a backfill, or an
            // accidental repeat) must not create a second document row
            // for a type this application already has — unlike
            // firstOrCreate/updateOrCreate above, ApplicationDocument::create()
            // has no such guard on its own.
            if ($application->documents()->where('document_type', $docType)->exists()) {
                $this->command->info("  [{$docType}] Already seeded for this application, skipping.");
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

        // updateOrCreate() above always resets a re-run's status back to
        // 'pending_prescreening', even when this application already has
        // all 3 documents from a previous run -- ProcessOcrDocument (and
        // the status recompute it triggers) only runs for a document
        // that's newly created THIS run, so an application whose
        // documents were all skipped as already-existing would otherwise
        // stay stuck showing 'pending_prescreening' despite already being
        // fully processed. Recomputing here covers both that case and the
        // normal one (a no-op if any document isn't 'processed' yet).
        Application::refreshStatusFromDocuments($application);

        $this->command->info("  Open /VerifierApplicationReview/{$application->id} as your verifier account to view/screenshot.");
    }
}
