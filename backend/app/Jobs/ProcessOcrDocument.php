<?php

namespace App\Jobs;

use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\OcrResult;
use App\Models\VerificationCheck;
use App\Notifications\ApplicationStatusNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use GuzzleHttp\Client;

class ProcessOcrDocument implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Allow the job to run up to 4 minutes before Laravel forces a timeout
    public $timeout = 240;

    // Limit retries so it doesn't slam your Python API if something breaks
    public $tries = 2;

    protected $application;
    protected $document;
    protected $filePath;

    public function __construct(Application $application, ApplicationDocument $document, string $filePath)
    {
        $this->application = $application;
        $this->document = $document;
        $this->filePath = $filePath;
        $this->onQueue('ocr');
    }

    public function handle()
    {
        if ($this->document->status === 'processed') {
            return;
        }
    
        try {
            $storagePath = Storage::disk('local')->path($this->filePath);
            if (!file_exists($storagePath)) {
                throw new \Exception("File not found: {$storagePath}");
            }
    
            // Clear any stale results from a prior processing attempt on
            // this exact document row, so reprocessing (retry, manual
            // re-trigger during testing, etc.) doesn't leave old and new
            // checks sitting side by side in the same table.
            \App\Models\VerificationCheck::where('document_id', $this->document->id)->delete();
            \App\Models\OcrResult::where('document_id', $this->document->id)->delete();

            // Update the timeout to 180 seconds to accommodate heavy PaddleOCR models
            $client = new Client([
                'timeout'         => 180,
                'connect_timeout' => 10 // Optional: fail fast if the server is completely down
            ]);

            $user    = $this->application->user;
            $config  = $this->application->configuration;
            $profile = $user->profile;

            $multipart = [
                ['name' => 'file', 'contents' => fopen($storagePath, 'r'), 'filename' => $this->document->file_name],
                ['name' => 'first_name',  'contents' => $user->first_name],
                ['name' => 'middle_name', 'contents' => $user->middle_name ?? ''],
                ['name' => 'last_name',   'contents' => $user->last_name],
            ];

            $endpoint = match($this->document->document_type) {
                'voters_certificate' => '/api/ocr/voters-certificate',
                'registration_form'  => '/api/ocr/registration-form',
                'school_id'          => '/api/ocr/school-id',
            };

            if ($this->document->document_type === 'registration_form') {
                $multipart[] = ['name' => 'declared_school', 'contents' => $this->application->school_name];
                $multipart[] = ['name' => 'school_year',     'contents' => $config->school_year];
            }

            if ($this->document->document_type === 'school_id') {
                $multipart[] = ['name' => 'declared_school', 'contents' => $this->application->school_name];
            }

            if ($this->document->document_type === 'voters_certificate') {
                $isMinor = $profile?->is_minor ?? false;
                $multipart[] = ['name' => 'is_minor', 'contents' => $isMinor ? '1' : '0'];
                $multipart[] = ['name' => 'guardian_first_name',  'contents' => $profile?->guardian_first_name ?? ''];
                $multipart[] = ['name' => 'guardian_middle_name', 'contents' => $profile?->guardian_middle_name ?? ''];
                $multipart[] = ['name' => 'guardian_last_name',   'contents' => $profile?->guardian_last_name ?? ''];

                // Voter's Certificate should be issued/updated within the
                // current calendar year — confirmed directly by SK during
                // the needs-assessment interview. Enforced unconditionally
                // for every cycle, not admin-configurable, since this is a
                // fixed rule rather than something that varies per period.
                $multipart[] = ['name' => 'enforce_cert_year', 'contents' => 'true'];
                $multipart[] = ['name' => 'cert_year', 'contents' => '2026'];
                //$multipart[] = ['name' => 'cert_year',         'contents' => (string) now()->year];
            }

            $flaskUrl = env('OCR_SERVICE_URL', 'http://localhost:5000');
            $response = $client->post($flaskUrl . $endpoint, ['multipart' => $multipart]);
            $result = json_decode($response->getBody()->getContents(), true);

            if (!$result['success']) {
                $this->document->update(['status' => 'failed']);
                return;
            }

            $data = $result['verification'] ?? [];
            $isLowConfidenceFlag = $data['low_confidence'] ?? false;

            $ocrResult = OcrResult::create([
                'document_id'      => $this->document->id,
                'extracted_fields' => $result['verification'] ?? [],
                'confidence_score' => $result['avg_confidence'] ?? null,
                'is_low_confidence'=> $isLowConfidenceFlag,
                'raw_text'         => json_encode($result['ocr_lines'] ?? []),
            ]);

            $verification = isset($data['checks']) ? $data['checks'] : $data;

            foreach ($verification as $checkName => $checkData) {
                if (is_int($checkName) && isset($checkData['raw'])) {
                    $checkName = "OCR_Raw_Capture_" . $checkName;
                }

                if (!is_array($checkData)) continue;

                VerificationCheck::create([
                    'application_id' => $this->application->id,
                    'document_id'    => $this->document->id,
                    'ocr_result_id'  => $ocrResult->id,
                    'check_name'     => is_string($checkName) ? $checkName : 'check',
                    'passed'         => $checkData['passed'] ?? false,
                    'extracted_value'=> $checkData['extracted'] ?? $checkData['raw'] ?? null,
                    'expected_value' => $checkData['expected'] ?? null,
                    'flag_reason'    => $checkData['reason'] ?? null,
                ]);
            }

            $this->document->update(['status' => 'processed']);
            $this->updateApplicationStatus($this->application);
        } catch (\Exception $e) {
            $this->document->update(['status' => 'failed']);
            \Log::error("OCR Processing Failed for Doc {$this->document->id}: " . $e->getMessage());
        }
    }

    private function updateApplicationStatus($application): void
    {
        // 1. Get the primary keys of the LATEST uploads for each document type
        $latestDocIds = ApplicationDocument::where('application_id', $application->id)
            ->select(DB::raw('MAX(id) as id'))
            ->groupBy('document_type')
            ->pluck('id');

        // 2. Map status checks using only these latest documents
        $latestDocuments = ApplicationDocument::whereIn('id', $latestDocIds)->get();
        $docTypes        = $latestDocuments->pluck('status', 'document_type');
        $requiredTypes   = ['voters_certificate', 'registration_form', 'school_id'];

        foreach ($requiredTypes as $type) {
            if (!isset($docTypes[$type]) || $docTypes[$type] !== 'processed') {
                return; // Still waiting for one of the core types to finish processing
            }
        }

        // 3. Scan for validation failures ONLY within the latest file versions
        $hasFailedCheck = VerificationCheck::whereIn('document_id', $latestDocIds)
            ->where('passed', false)
            ->exists();

        // 4. Scan for low confidence flags ONLY within the latest file versions
        $isLowConfidence = OcrResult::whereIn('document_id', $latestDocIds)
            ->where('is_low_confidence', true)
            ->exists();

        // 5. Route the status dynamically based on current values
        if ($hasFailedCheck || $isLowConfidence) {
            $application->update(['status' => 'for_review']);
            return;
        }

        $outcome = \App\Models\Application::tryApprove($application);

        if ($outcome['result'] === 'no_slots') {
            // Passed every automated check — genuinely qualified, just
            // arrived after the cap. Waitlisted rather than dropped or sent
            // to manual review, since a verifier reviewing this wouldn't
            // find anything to decide: the checks already passed.
            \App\Models\Application::moveToWaitlist($application);

            $application->user->notify(new ApplicationStatusNotification(
                'Waitlisted',
                "Your application met all requirements, but all slots for this period are currently filled. This does not guarantee a slot — you will only be approved if a slot opens up. If a slot opens, we will notify you before the grace period ends."
            ));
            return;
        }

        // Trigger Automated System Approval Notification
        $application->user->notify(new ApplicationStatusNotification(
            'Approved',
            'Congratulations! Your application has been approved. Please prepare your physical documents for submission and stay tuned for further instructions.'
        ));
    }
}