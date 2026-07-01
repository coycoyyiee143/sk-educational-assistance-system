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

    protected $application;
    protected $document;
    protected $filePath;

    public function __construct(Application $application, ApplicationDocument $document, string $filePath)
    {
        $this->application = $application;
        $this->document = $document;
        $this->filePath = $filePath;
    }

    public function handle()
    {
        try {
            // Get full path to stored file
            $storagePath = Storage::disk('public')->path($this->filePath);

            if (!file_exists($storagePath)) {
                throw new \Exception("File not found: {$storagePath}");
            }

            $client = new Client(['timeout' => 60]);
            $user   = $this->application->user;
            $config = $this->application->configuration;

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
                $multipart[] = ['name' => 'semester',        'contents' => $config->semester];
            }

            if ($this->document->document_type === 'school_id') {
                $multipart[] = ['name' => 'declared_school', 'contents' => $this->application->school_name];
            }

            $flaskUrl = env('OCR_SERVICE_URL', 'http://localhost:5000');
            $response = $client->post($flaskUrl . $endpoint, ['multipart' => $multipart]);
            $result = json_decode($response->getBody()->getContents(), true);

            if (!$result['success']) {
                $this->document->update(['status' => 'failed']);
                return;
            }

            $ocrResult = OcrResult::create([
                'document_id'      => $this->document->id,
                'extracted_fields' => $result['verification'] ?? [],
                'confidence_score' => $result['avg_confidence'] ?? null,
                'is_low_confidence'=> ($result['avg_confidence'] ?? 1) < 0.7,
                'raw_text'         => json_encode($result['ocr_lines'] ?? []),
            ]);

            $data = $result['verification'] ?? [];
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
        } else {
            // Updated to call your centralized model method
            $application->update([
                'status'         => 'approved',
                'control_number' => \App\Models\Application::generateControlNumber($application->config_id),
            ]);

            // Trigger Automated System Approval Notification
            $application->user->notify(new ApplicationStatusNotification(
                'Approved',
                'Congratulations! Your application has been approved. Please prepare your physical documents for submission and stay tuned for further instructions.'
            ));
        }
    }
}