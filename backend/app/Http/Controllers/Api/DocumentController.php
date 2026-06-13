<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\OcrResult;
use App\Models\VerificationCheck;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

class DocumentController extends Controller
{
    private function getFlaskUrl(): string
    {
        return env('OCR_SERVICE_URL', 'http://localhost:5000');
    }

    public function index(Request $request, $id)
    {
        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return response()->json($application->documents);
    }

    public function upload(Request $request, $id)
    {
        $request->validate([
            'document_type' => 'required|in:voters_certificate,registration_form,school_id',
            'file'          => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with(['user.profile', 'configuration'])
            ->firstOrFail();

        $file     = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $path     = $file->storeAs(
            "documents/{$application->id}",
            $fileName,
            'public'
        );

        $document = ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type'  => $request->document_type,
            'file_path'      => $path,
            'file_name'      => $fileName,
            'mime_type'      => $file->getMimeType(),
            'version'        => 1,
            'status'         => 'processing',
        ]);

        // Trigger OCR
        $this->processOcr($application, $document, $file->getRealPath());

        return response()->json([
            'message'  => 'Document uploaded.',
            'document' => $document->fresh(),
        ], 201);
    }

    public function reupload(Request $request, $id, $docId)
    {
        $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with(['user.profile', 'configuration'])
            ->firstOrFail();

        $oldDocument = ApplicationDocument::where('id', $docId)
            ->where('application_id', $application->id)
            ->firstOrFail();

        $file     = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $path     = $file->storeAs(
            "documents/{$application->id}",
            $fileName,
            'public'
        );

        $newDocument = ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type'  => $oldDocument->document_type,
            'file_path'      => $path,
            'file_name'      => $fileName,
            'mime_type'      => $file->getMimeType(),
            'version'        => $oldDocument->version + 1,
            'status'         => 'processing',
        ]);

        // Trigger OCR
        $this->processOcr($application, $newDocument, $file->getRealPath());

        return response()->json([
            'message'  => 'Document re-uploaded.',
            'document' => $newDocument->fresh(),
        ], 201);
    }

    private function processOcr($application, $document, $filePath): void
    {
        try {
            $client = new Client(['timeout' => 60]);
            $user   = $application->user;
            $config = $application->configuration;

            $multipart = [
                ['name' => 'file', 'contents' => fopen($filePath, 'r'), 'filename' => $document->file_name],
                ['name' => 'first_name',  'contents' => $user->first_name],
                ['name' => 'middle_name', 'contents' => $user->middle_name ?? ''],
                ['name' => 'last_name',   'contents' => $user->last_name],
            ];

            $endpoint = match($document->document_type) {
                'voters_certificate' => '/api/ocr/voters-certificate',
                'registration_form'  => '/api/ocr/registration-form',
                'school_id'          => '/api/ocr/school-id',
            };

            if ($document->document_type === 'registration_form') {
                $multipart[] = ['name' => 'declared_school', 'contents' => $application->school_name];
                $multipart[] = ['name' => 'school_year',     'contents' => $config->school_year];
                $multipart[] = ['name' => 'semester',        'contents' => $config->semester];
            }

            if ($document->document_type === 'school_id') {
                $multipart[] = ['name' => 'declared_school', 'contents' => $application->school_name];
            }

            $response = $client->post($this->getFlaskUrl() . $endpoint, ['multipart' => $multipart]);
            $result = json_decode($response->getBody()->getContents(), true);

            if (!$result['success']) {
                $document->update(['status' => 'failed']);
                return;
            }

            $ocrResult = OcrResult::create([
                'document_id'      => $document->id,
                'extracted_fields' => $result['verification'] ?? [],
                'confidence_score' => $result['avg_confidence'] ?? null,
                'is_low_confidence'=> ($result['avg_confidence'] ?? 1) < 0.7,
                'raw_text'         => json_encode($result['ocr_lines'] ?? []),
            ]);

            // FIX: Handle nested 'checks' array if present
            $data = $result['verification'] ?? [];
            $verification = isset($data['checks']) ? $data['checks'] : $data;

            foreach ($verification as $checkName => $checkData) {
                // If it's a list (like in the registration form), adjust
                if (is_int($checkName) && isset($checkData['raw'])) {
                    $checkName = "OCR_Raw_Capture_" . $checkName;
                }

                if (!is_array($checkData)) continue;

                VerificationCheck::create([
                    'application_id' => $application->id,
                    'document_id'    => $document->id,
                    'ocr_result_id'  => $ocrResult->id,
                    'check_name'     => is_string($checkName) ? $checkName : 'check',
                    'passed'         => $checkData['passed'] ?? false,
                    'extracted_value'=> $checkData['extracted'] ?? $checkData['raw'] ?? null,
                    'expected_value' => $checkData['expected'] ?? null,
                    'flag_reason'    => $checkData['reason'] ?? null,
                ]);
            }

            $document->update(['status' => 'processed']);
            $this->updateApplicationStatus($application);

        } catch (\Exception $e) {
            $document->update(['status' => 'failed']);
            \Log::error("OCR Processing Failed for Doc {$document->id}: " . $e->getMessage());
        }
    }

    private function updateApplicationStatus($application): void
    {
        $application->load('documents.verificationChecks');

        $allDocuments = $application->documents;

        // Check if all 3 documents are uploaded and processed
        $docTypes     = $allDocuments->pluck('status', 'document_type');
        $requiredTypes = ['voters_certificate', 'registration_form', 'school_id'];

        foreach ($requiredTypes as $type) {
            if (!isset($docTypes[$type]) || $docTypes[$type] !== 'processed') {
                // Not all documents uploaded yet, leave status as is
                return;
            }
        }

        // All documents processed — check if any verification check failed
        $hasFailedCheck = VerificationCheck::where('application_id', $application->id)
            ->where('passed', false)
            ->exists();

        $isLowConfidence = OcrResult::whereIn(
            'document_id',
            $allDocuments->pluck('id')
        )->where('is_low_confidence', true)->exists();

        if ($hasFailedCheck || $isLowConfidence) {
            $application->update(['status' => 'for_review']);
        } else {
            $application->update([
                'status'         => 'approved',
                'control_number' => $this->generateControlNumber(),
            ]);
        }
    }

    private function generateControlNumber(): string
    {
        return 'SK-' . date('Y') . '-' . strtoupper(substr(uniqid(), -6));
    }
}