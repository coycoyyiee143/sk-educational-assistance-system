<?php


namespace App\Jobs;


use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Models\OcrResult;
use App\Models\VerificationCheck;
use App\Notifications\ApplicationStatusNotification;
use App\Services\DocumentReuploadRoutingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;


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


    /**
     * Was previously one ~200-line try/catch around the whole method,
     * with a single generic "OCR Processing Failed for Doc {id}: {msg}"
     * log line no matter what actually broke — file missing, the OCR
     * service being unreachable, a malformed/non-JSON response from it,
     * or a DB write failing partway through all looked identical in the
     * logs. Split into scoped stages below so the log line itself tells
     * you which stage failed, without needing to reproduce the failure
     * to find out.
     */
    public function handle()
    {
        if ($this->document->status === 'processed') {
            return;
        }

        // Stage 1: local file must exist before anything else is worth doing.
        $storagePath = Storage::disk('local')->path($this->filePath);
        if (!file_exists($storagePath)) {
            \Log::error("OCR processing failed for doc {$this->document->id}: file not found at {$storagePath}");
            $this->document->update(['status' => 'failed']);
            return;
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
            // school year's starting calendar year — confirmed directly
            // by SK during the needs-assessment interview. Enforced
            // unconditionally for every cycle, not admin-configurable,
            // since this is a fixed rule rather than something that
            // varies per period.
            //
            // Derived from the active period's school_year (e.g.
            // "2025-2026" -> 2025) rather than the server's current
            // calendar year, since an application submitted any time
            // during the school year should validate against the year
            // the period actually started, not whatever date happens
            // to be "today" on the server.
            $schoolYearStart = (int) explode('-', $config->school_year)[0];


            $multipart[] = ['name' => 'enforce_cert_year', 'contents' => 'true'];
            $multipart[] = ['name' => 'cert_year', 'contents' => (string) $schoolYearStart];
        }


        $flaskUrl = env('OCR_SERVICE_URL', 'http://localhost:5000');

        // Stage 2: the network call to the OCR microservice — the part
        // most likely to fail for reasons that have nothing to do with
        // this document (service down, still starting up, timed out
        // under load). Caught separately so the log says exactly that,
        // instead of getting lumped in with a genuine processing bug.
        try {
            $response = $client->post($flaskUrl . $endpoint, ['multipart' => $multipart]);
        } catch (ConnectException $e) {
            \Log::error("OCR service unreachable for doc {$this->document->id} at {$flaskUrl}{$endpoint}: " . $e->getMessage());
            $this->document->update(['status' => 'failed']);
            return;
        } catch (RequestException $e) {
            \Log::error("OCR service request failed for doc {$this->document->id}: " . $e->getMessage());
            $this->document->update(['status' => 'failed']);
            return;
        }

        // Stage 3: response must actually be the JSON shape we expect.
        // Previously `json_decode` returning null here (e.g. the service
        // crashed and returned an HTML error page instead of JSON) would
        // make the very next line, `if (!$result['success'])`, throw a
        // "trying to access array offset on null" error — which then
        // just got swallowed by the old single catch-all as if it were
        // an ordinary OCR failure. Guarded explicitly now, with its own
        // log line, so that specific failure mode is distinguishable
        // from a genuine "the OCR service said no" response.
        $result = json_decode($response->getBody()->getContents(), true);

        if (!is_array($result) || !isset($result['success'])) {
            \Log::error("OCR service returned an unreadable response for doc {$this->document->id}: " . $response->getBody());
            $this->document->update(['status' => 'failed']);
            return;
        }

        if (!$result['success']) {
            \Log::warning("OCR service reported failure for doc {$this->document->id}: " . ($result['error'] ?? 'no error message given'));
            $this->document->update(['status' => 'failed']);
            return;
        }

        // Stage 4: everything from here on is trusted local processing —
        // saving the OCR result, writing VerificationCheck rows, and
        // deciding the application's status. Kept in its own try/catch
        // so a DB failure here is clearly labelled as a save failure,
        // not confused with a network or response-shape problem above.
        try {
            $data = $result['verification'] ?? [];


            // Upload-check short-circuit (wrong document type, too low
            // quality, or a confidently-wrong cert year). Record the flag
            // ON THIS DOCUMENT only — do NOT decide the application's
            // status here. The other two documents may be processing
            // concurrently in separate jobs and may ALSO have their own
            // issues; deciding immediately here would only ever surface
            // one problem at a time instead of all of them together.
            // updateApplicationStatus() below (which already waits for
            // all three documents) is the single place that makes the
            // final call.
            if (($data['flag_reason'] ?? null) === 'auto_reupload') {
                $this->document->update([
                    'status'                  => 'processed',
                    'needs_auto_reupload'     => true,
                    'auto_reupload_reason'    => $data['auto_reupload_reason'] ?? 'System detected an issue with this document.',
                    'auto_reupload_category'  => $data['auto_reupload_category'] ?? null,
                ]);


                \App\Models\AuditLog::record(
                    'auto_reupload_flagged',
                    $this->document,
                    $data['auto_reupload_reason'] ?? 'System detected an issue with this document.'
                );


                $this->updateApplicationStatus($this->application);
                return;
            }


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
                    'metadata'       => $checkData['metadata'] ?? null,
                ]);
            }


            $this->document->update(['status' => 'processed']);
            $this->updateApplicationStatus($this->application);
        } catch (\Throwable $e) {
            \Log::error("Saving OCR results failed for doc {$this->document->id}: " . $e->getMessage());
            $this->document->update(['status' => 'failed']);
        }
    }


    public function middleware()
    {
        // Scoped per-application, NOT a single fixed string. The fixed
        // key 'ocr-processing' previously used here serializes EVERY
        // OCR job system-wide -- only one document, for one applicant,
        // could process at a time, for the entire system, regardless
        // of how many queue workers are running. Every other job just
        // sits and retries every 60s.
        //
        // The actual protection this middleware exists for is almost
        // certainly preventing a race in updateApplicationStatus(): all
        // three of an application's document jobs call it at the end,
        // and if two finish within moments of each other, both could
        // read the "still waiting on other documents" state
        // simultaneously and neither would correctly detect that all
        // three are done -- or worse, both attempt conflicting writes
        // to the same Application row's status at once. Scoping the
        // key to the application id preserves exactly that protection
        // (this application's 3 document jobs still can't overlap each
        // other) while letting DIFFERENT applicants process fully in
        // parallel, limited only by actual worker/OCR-service capacity
        // instead of an unrelated global lock.
        //
        // IMPORTANT CAVEAT: this alone does not give you real parallel
        // THROUGHPUT. The OCR Flask service itself (ocr-service/run.py)
        // runs via `app.run(debug=True)` with no `threaded=True` and no
        // multi-worker WSGI server -- it can only handle one HTTP
        // request at a time regardless of what Laravel sends it.
        // Loosening this lock only helps once the OCR service side is
        // also given real concurrency (e.g. `threaded=True`, verified
        // safe for concurrent PaddleOCR inference on one process first,
        // or a production WSGI server with multiple workers). Without
        // that, concurrent jobs dispatched from here will simply queue
        // up at the OCR service's HTTP layer instead -- the bottleneck
        // moves, it doesn't disappear.
        return [(new \Illuminate\Queue\Middleware\WithoutOverlapping("ocr-processing-{$this->application->id}"))->releaseAfter(60)];
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


        // 3. All three documents are done. Check for auto-reupload flags
        // FIRST, across all of them together, and aggregate every reason
        // found — so the applicant sees every problem at once, not one
        // at a time across repeated resubmissions.
        $autoReuploadDocs = $latestDocuments->filter(fn($d) => $d->needs_auto_reupload);


        if ($autoReuploadDocs->isNotEmpty()) {
            // Capped-category list and max-attempt count are centralized
            // in DocumentReuploadRoutingService / config/document_verification.php
            // instead of hardcoded here — see AUTO_REUPLOAD_VERIFICATION_RULES.md
            // for the reasoning behind the categories and the attempt cap.
            $routing = new DocumentReuploadRoutingService();

            $escalated = $autoReuploadDocs->filter(
                fn($doc) => $routing->shouldEscalate($application, $doc)
            );


            if ($escalated->isNotEmpty()) {
                // 4th+ capped-category attempt on at least one document —
                // escalate to a human instead of looping the applicant again.
                // Build a full history so the verifier sees every prior
                // reason, not just the latest one.
                foreach ($escalated as $doc) {
                    $history = $routing->attemptHistory($application, $doc);
                    $historyText = collect($history)
                        ->map(fn($r, $i) => "Attempt " . ($i + 1) . ": {$r}")
                        ->implode(' | ');


                    VerificationCheck::create([
                        'application_id' => $application->id,
                        'document_id'    => $doc->id,
                        'ocr_result_id'  => null,
                        'check_name'     => 'repeated_auto_reupload_escalation',
                        'passed'         => false,
                        'extracted_value'=> null,
                        'expected_value' => null,
                        'flag_reason'    => "Flagged " . count($history) . " times for the same type of issue — escalated for manual review. History: {$historyText}",
                    ]);
                }


                $application->update([
                    'status'               => 'for_review',
                    'auto_reupload_reason' => null,
                ]);
                return;
            }


            $reasons = $autoReuploadDocs->pluck('auto_reupload_reason')->filter()->unique()->values();
            $combinedReason = $reasons->count() > 1
                ? $reasons->map(fn($r, $i) => ($i + 1) . ". {$r}")->implode(' ')
                : $reasons->first();


            $application->update([
                'status'               => 'auto_reupload_requested',
                'auto_reupload_reason' => $combinedReason,
            ]);


            $application->user->notify(new ApplicationStatusNotification(
                'Re-upload Needed',
                $combinedReason
            ));
            return;
        }


        // 4. Scan for validation failures ONLY within the latest file versions
        $hasFailedCheck = VerificationCheck::whereIn('document_id', $latestDocIds)
            ->where('passed', false)
            ->exists();


        // 5. Scan for low confidence flags ONLY within the latest file versions
        $isLowConfidence = OcrResult::whereIn('document_id', $latestDocIds)
            ->where('is_low_confidence', true)
            ->exists();


        // 6. Route the status dynamically based on current values
        if ($hasFailedCheck || $isLowConfidence) {
            $application->update([
                'status'               => 'for_review',
                'auto_reupload_reason' => null,
            ]);
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


        $application->update(['auto_reupload_reason' => null]);


        // Trigger Automated System Approval Notification
        $application->user->notify(new ApplicationStatusNotification(
            'Approved',
            'Congratulations! Your application has been approved. Please prepare your physical documents for submission and stay tuned for further instructions.'
        ));
    }
}