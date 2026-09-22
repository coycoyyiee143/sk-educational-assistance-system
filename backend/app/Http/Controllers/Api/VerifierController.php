<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\VerifierAction;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Services\ClaimingAssignmentService;
use App\Traits\LateClaimingEligibility;
use App\Notifications\ClaimingScheduleNotification;
use App\Notifications\ApplicationStatusNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use GuzzleHttp\Client;

class VerifierController extends Controller
{
    use LateClaimingEligibility;

    private const VIEWER_STALE_SECONDS = 30;

    public function stats()
    {
        $activeConfig = ApplicationConfiguration::where('is_active', true)->first();

        if (!$activeConfig) {
            return response()->json([
                'pending'   => 0,
                'review'    => 0,
                'approved'  => 0,
                'claimed'   => 0,
                'rejected'  => 0,
                'failed_ocr' => 0,
                'appeal_requested' => 0,
                'no_active_period' => true,
            ]);
        }

        // Same sk_verifier role handles both online review and claiming-day
        // lanes (see routes/api.php), so "Approved"/"Rejected" here should
        // stay consistent with the admin-side definitions: approved =
        // approved+claimed+unclaimed (still holds/held a slot this verifier
        // granted), rejected = rejected+not_cleared (never got funded,
        // whether that was decided online or at claiming). Otherwise an
        // applicant a verifier approved would silently drop out of their
        // own "Approved" count the moment claiming day resolves them.
        return response()->json([
            'pending'   => Application::where('config_id', $activeConfig->id)->whereIn('status', ['pending_prescreening', 'auto_reupload_requested', 'reupload_requested'])->whereHas('documents')->count(),
            'review'    => Application::where('config_id', $activeConfig->id)->where('status', 'for_review')->count(),
            'approved'  => Application::where('config_id', $activeConfig->id)->whereIn('status', ['approved', 'claimed', 'unclaimed'])->count(),
            'claimed'   => Application::where('config_id', $activeConfig->id)->where('status', 'claimed')->count(),
            'rejected'  => Application::where('config_id', $activeConfig->id)->whereIn('status', ['rejected', 'not_cleared'])->count(),
            // Applications sitting on at least one OCR-failed document —
            // previously invisible from the dashboard entirely.
            'failed_ocr' => Application::where('config_id', $activeConfig->id)
                ->whereHas('documents', fn($q) => $q->where('status', 'failed'))
                ->count(),
            // Appeals need a verifier decision but aren't part of the FCFS
            // "for_review" queue, so they're surfaced as a separate count/
            // banner instead of being folded into that queue's ordering.
            'appeal_requested' => Application::where('config_id', $activeConfig->id)->where('status', 'appeal_requested')->count(),
            'no_active_period' => false,
        ]);
    }

    public function index(Request $request)
{
    $activeConfig = ApplicationConfiguration::where('is_active', true)->first();
    $configId = $request->query('config_id', $activeConfig?->id);

    $applications = Application::with(['user', 'verifierActions', 'documents'])
        ->where('config_id', $configId)
        ->where(function ($query) {
            $query->where('status', '!=', 'pending_prescreening')
                ->orWhereHas('documents');
        })
        ->orderBy('submitted_at', 'asc')   // FCFS: earliest submission first
        ->orderBy('created_at', 'asc')
        ->get()
        ->map(function ($app) {
            return [
                'id'                    => $app->id,
                'control_number'        => $app->control_number,
                'name'                  => $app->user->first_name . ' ' . $app->user->last_name,
                'submitted_at'          => $app->submitted_at,
                'updated_at'            => $app->updated_at,
                'status'                => $app->status,
                'school_name'           => $app->school_name,
                'verifier_actions'      => $app->verifierActions->map(fn($a) => ['action' => $a->action]),
                // Surfaced so the list can flag "needs attention" without a
                // verifier having to open the application first — previously
                // a failed document was invisible until someone happened to
                // click into that specific applicant's review page.
                'failed_documents_count' => $app->documents->where('status', 'failed')->count(),
            ];
        });

    return response()->json($applications);
}

    public function show($id)
    {
        $app = Application::with([
            'user.profile',
            'documents.ocrResult',
            'verificationChecks',
            'configuration',
            'verifierActions' => function($q) {
                // Full history (not just the latest) so the frontend can
                // correlate past reupload_requested actions with the
                // specific document version they superseded, for the
                // per-document "Previous versions" history view.
                $q->latest();
            },
        ])->findOrFail($id);

        return response()->json($app);
    }

    // Heartbeat, not a lock — a verifier opening the review page pings
    // this every ~10s (see the frontend's usePolling) to (a) claim/refresh
    // their own presence and (b) find out if someone ELSE'S presence is
    // still fresh, so the page can show a "so-and-so is also viewing
    // this" notice. Nobody is blocked from acting either way; this is
    // purely informational. A verifier's presence is considered stale
    // (equivalent to having left) once VIEWER_STALE_SECONDS pass without
    // a heartbeat — there's no explicit release on navigate-away/tab
    // close, since those aren't reliably observable from the backend.
    public function heartbeat(Request $request, $id)
    {
        $app = Application::findOrFail($id);
        $me = $request->user();

        $otherViewer = null;
        if (
            $app->viewing_verifier_id
            && $app->viewing_verifier_id !== $me->id
            && $app->viewing_heartbeat_at
            && $app->viewing_heartbeat_at->gt(now()->subSeconds(self::VIEWER_STALE_SECONDS))
        ) {
            $viewer = $app->viewingVerifier;
            if ($viewer) {
                $otherViewer = [
                    'id'    => $viewer->id,
                    'name'  => "{$viewer->first_name} {$viewer->last_name}",
                    'since' => $app->viewing_heartbeat_at,
                ];
            }
        }

        $app->update([
            'viewing_verifier_id'  => $me->id,
            'viewing_heartbeat_at' => now(),
        ]);

        return response()->json(['other_viewer' => $otherViewer]);
    }

    public function approve(Request $request, $id)
    {
        // Eager-loaded user relationship to make sure notification finds the recipient email
        $app = Application::with(['user', 'configuration'])->findOrFail($id);

        if ($app->status === 'approved') {
            return response()->json(['message' => 'Application already approved.'], 400);
        }

        $outcome = Application::tryApprove($app);

        if ($outcome['result'] === 'no_slots') {
            Application::moveToWaitlist($app);

            $app->user->notify(new ApplicationStatusNotification(
                'Waitlisted',
                "Your application met all requirements, but all slots for this period are currently filled. This does not guarantee a slot — you will only be approved if a slot opens up. If a slot opens, we will notify you before Late Claiming ends."
            ));

            return response()->json(['message' => 'No slots available — applicant added to waitlist instead.']);
        }

        VerifierAction::create([
            'application_id' => $app->id,
            'verifier_id'    => $request->user()->id,
            'action'         => 'approved',
            'notes'          => $request->notes ?? null,
        ]);

        // Log this approval for the audit trail
        \App\Models\AuditLog::record(
            'application_approved',
            $app,
            "Approved application #{$app->id} ({$app->user->first_name} {$app->user->last_name})"
        );

        // Real-time claiming assignment: if the active period already has
        // an active ClaimingSchedule with room, this applicant is placed
        // on a lane and notified with their actual claiming date/lane
        // immediately — no more waiting for a separate bulk "activate"
        // step to run first. assignToLane() itself sends the
        // ClaimingScheduleNotification when it succeeds, so we only fall
        // back to the generic approval notice below when it doesn't (no
        // active schedule yet, or every lane is currently full — either
        // way they stay 'approved' and get picked up automatically the
        // next time a schedule activates or room opens up).
        $assignment = ClaimingAssignmentService::assignToLane($app);

        if (!$assignment) {
            $app->user->notify(new ApplicationStatusNotification(
                'Approved',
                'Congratulations! Your application has been approved. Please wait for announcements regarding the physical document submission and distribution schedule.'
            ));
        }

        return response()->json([
            'message'    => 'Application approved.',
            'assignment' => $assignment,
        ]);
    }

    public function promoteFromWaitlist(Request $request, $configId)
    {
        $config = ApplicationConfiguration::findOrFail($configId);

        // Promoting from the waitlist only makes sense once the
        // application period has actually closed — while it's still
        // open, applicants are still submitting fresh, so a "waitlisted"
        // applicant hasn't really lost their shot yet. Promoting early
        // also directly causes a control-number gap: a promoted applicant
        // consumes the next sequence number but lands on the Late Claiming
        // lane instead of a regular one, splitting what would otherwise
        // be a clean sequential range for whichever lane was filling at
        // that moment.
        if (now()->lt($config->close_date)) {
            return response()->json([
                'message' => 'This application period is still open. Waitlist promotion is only available after the Closing Date (' . $config->close_date . ') has passed.',
            ], 400);
        }

        $outcome = Application::promoteNextFromWaitlist($configId);

        if ($outcome['result'] === 'no_waitlist') {
            return response()->json(['message' => 'No waitlisted applicants available to promote.'], 400);
        }

        if ($outcome['result'] === 'no_slots') {
            return response()->json(['message' => 'No slots available to promote into.'], 400);
        }

        $promoted = $outcome['application'];

        \App\Models\AuditLog::record(
            'application_approved',
            $promoted,
            "Promoted application #{$promoted->id} from waitlist ({$promoted->user->first_name} {$promoted->user->last_name})"
        );

        $schedule = ClaimingSchedule::where('config_id', $configId)
            ->where('is_active', true)
            ->latest()
            ->first();

        if ($schedule && $schedule->late_claiming_date) {
            $lane = ClaimingLane::firstOrCreate(
                [
                    'claiming_schedule_id' => $schedule->id,
                    'lane_name'            => 'Late Claiming',
                ],
                [
                    'batch'         => 'morning',
                    'claiming_date' => $schedule->late_claiming_date,
                    'capacity'      => null,
                ]
            );

            $assignment = ClaimingAssignment::updateOrCreate(
                ['application_id' => $promoted->id],
                [
                    'claiming_schedule_id' => $schedule->id,
                    'claiming_lane_id'     => $lane->id,
                    'claim_status'         => 'pending_claiming',
                    'source'               => 'waitlist_promotion',
                ]
            );

            $promoted->user->notify(new ClaimingScheduleNotification($promoted, $lane, $schedule, $assignment));
        } else {
            $promoted->user->notify(new ApplicationStatusNotification(
                'Approved',
                'A slot has opened up and your application has now been approved! Please prepare your physical documents for submission.'
            ));
        }

        return response()->json(['message' => 'Applicant promoted from waitlist.', 'application' => $promoted]);
    }

    public function promoteAllFromWaitlist(Request $request, $configId)
    {
        $config = ApplicationConfiguration::findOrFail($configId);

        if (now()->lt($config->close_date)) {
            return response()->json([
                'message' => 'This application period is still open. Waitlist promotion is only available after the Closing Date (' . $config->close_date . ') has passed.',
            ], 400);
        }

        $waitlistExists = Application::where('config_id', $configId)
            ->where('status', 'waitlisted')
            ->exists();

        if (!$waitlistExists) {
            return response()->json(['message' => 'No waitlisted applicants available to promote.'], 400);
        }

        $promotedList = Application::promoteAllFromWaitlist($configId);

        if (empty($promotedList)) {
            return response()->json(['message' => 'No slots available to promote into.'], 400);
        }

        $schedule = ClaimingSchedule::where('config_id', $configId)
            ->where('is_active', true)
            ->latest()
            ->first();

        foreach ($promotedList as $promoted) {
            \App\Models\AuditLog::record(
                'application_approved',
                $promoted,
                "Promoted application #{$promoted->id} from waitlist ({$promoted->user->first_name} {$promoted->user->last_name})"
            );

            if ($schedule && $schedule->late_claiming_date) {
                $lane = ClaimingLane::firstOrCreate(
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'lane_name'            => 'Late Claiming',
                    ],
                    [
                        'batch'         => 'morning',
                        'claiming_date' => $schedule->late_claiming_date,
                        'capacity'      => null,
                    ]
                );

                $assignment = ClaimingAssignment::updateOrCreate(
                    ['application_id' => $promoted->id],
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'claiming_lane_id'     => $lane->id,
                        'claim_status'         => 'pending_claiming',
                        'source'               => 'waitlist_promotion',
                    ]
                );

                $promoted->user->notify(new ClaimingScheduleNotification($promoted, $lane, $schedule, $assignment));
            } else {
                $promoted->user->notify(new ApplicationStatusNotification(
                    'Approved',
                    'A slot has opened up and your application has now been approved! Please prepare your physical documents for submission.'
                ));
            }
        }

        $count = count($promotedList);

        return response()->json([
            'message' => "{$count} applicant(s) promoted from waitlist.",
            'applications' => $promotedList,
        ]);
    }

    /**
     * Lists the active period's waitlist in promotion order, so a verifier
     * can see who's waiting and how long — promotion itself always pulls
     * the #1 position (strict FIFO via promoteNextFromWaitlist), so this
     * view is informational, not a picker.
     */
    public function waitlist(Request $request)
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();

        if (!$config) {
            return response()->json([
                'config_id' => null, 'waitlist' => [], 'not_cleared_count' => 0,
                'free_slots' => 0, 'period_open' => false, 'slots_full' => false,
            ]);
        }

        $waitlisted = Application::with('user')
            ->where('config_id', $config->id)
            ->where('status', 'waitlisted')
            ->orderBy('waitlisted_at')
            ->get()
            ->values()
            ->map(function ($app, $index) {
                return [
                    'id'            => $app->id,
                    'name'          => trim($app->user->first_name . ' ' . $app->user->last_name),
                    'school_name'   => $app->school_name,
                    'waitlisted_at' => $app->waitlisted_at,
                    'position'      => $index + 1,
                ];
            });

        // Historical count — how many not_cleared outcomes this period has had
        // in total, used only as the denominator for context.
        $notClearedCount = \App\Models\ClaimingAssignment::where('claim_status', 'not_cleared')
            ->whereHas('application', fn($q) => $q->where('config_id', $config->id))
            ->count();

        // Live count — slots_filled correctly reflects every promotion
        // (increments) and every not_cleared/unclaimed (decrements), so this
        // is always accurate right now, unlike a static count of past events.
        $freeSlots = $config->is_unlimited ? null : max(0, $config->slot_limit - $config->slots_filled);

        return response()->json([
            'config_id'          => $config->id,
            'waitlist'           => $waitlisted,
            'not_cleared_count'  => $notClearedCount,
            'free_slots'         => $freeSlots,
            // Live-snapshot flags: waitlist position/free-slot numbers
            // aren't "final" until the period is closed or slots are full
            // — the frontend uses these to show that caveat.
            'period_open'        => !$config->closed_at,
            'slots_full'         => $config->is_unlimited ? false : $config->slots_filled >= $config->slot_limit,
        ]);
    }

    public function reject(Request $request, $id)
    {
        $request->validate([
            'reason'              => 'required|string',
            'reason_categories'   => 'required|array|min:1',
            'reason_categories.*' => 'string',
        ]);

        $app = Application::with('user')->findOrFail($id);

        $app->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
        ]);

        VerifierAction::create([
            'application_id'    => $app->id,
            'verifier_id'       => $request->user()->id,
            'action'            => 'rejected',
            'reason_categories' => $request->reason_categories,
            'notes'             => $request->reason,
        ]);

        \App\Models\AuditLog::record(
            'application_rejected',
            $app,
            "Rejected application #{$app->id}. Reason: {$request->reason}"
        );

        $app->user->notify(new ApplicationStatusNotification(
            'Rejected',
            'We regret to inform you that your educational assistance application was not approved. Reason: ' . $request->reason
        ));

        return response()->json(['message' => 'Application rejected.']);
    }

    public function requestReupload(Request $request, $id)
    {
        $request->validate([
            'notes'                                  => 'required|string',
            'reupload_details'                       => 'required|array|min:1',
            'reupload_details.*.document_type'       => 'required|string',
            'reupload_details.*.reason_categories'   => 'required|array|min:1',
            'reupload_details.*.reason_categories.*' => 'string',
            'reupload_details.*.reason'              => 'required|string',
        ]);

        $app = Application::with('user')->findOrFail($id);

        $app->update(['status' => 'reupload_requested']);

        VerifierAction::create([
            'application_id'   => $app->id,
            'verifier_id'      => $request->user()->id,
            'action'           => 'reupload_requested',
            'notes'            => $request->notes,
            'reupload_details' => $request->reupload_details,
        ]);

        \App\Models\AuditLog::record(
            'application_reupload_requested',
            $app,
            "Requested document re-upload for application #{$app->id}. Notes: {$request->notes}"
        );

        $app->user->notify(new ApplicationStatusNotification(
            'Re-upload Requested',
            'The verifier reviewed your submission and flagged some missing or unreadable documents. Please review these notes: ' . $request->notes
        ));

        return response()->json(['message' => 'Re-upload requested.']);
    }

    // Resolves an appeal_requested application. Approved sends it back into
    // the normal manual review queue (for_review) — the verifier still
    // makes the real accept/reject call there via the existing
    // approve/reject actions, rather than this endpoint short-circuiting
    // straight to 'approved'. Denied restores it to 'rejected', where the
    // one-shot guard in ApplicationController::appeal() keeps it terminal.
    public function appealDecision(Request $request, $id)
    {
        $request->validate([
            'decision' => 'required|in:approved,denied',
            'notes'    => 'required|string',
        ]);

        $app = Application::with('user')->findOrFail($id);

        if ($app->status !== 'appeal_requested') {
            return response()->json(['message' => 'This application has no pending appeal.'], 400);
        }

        $newStatus = $request->decision === 'approved' ? 'for_review' : 'rejected';

        $app->update([
            'status'                => $newStatus,
            'appeal_decision_notes' => $request->notes,
            'appeal_decided_at'     => now(),
        ]);

        VerifierAction::create([
            'application_id' => $app->id,
            'verifier_id'    => $request->user()->id,
            'action'         => $request->decision === 'approved' ? 'appeal_approved' : 'appeal_denied',
            'notes'          => $request->notes,
        ]);

        \App\Models\AuditLog::record(
            'application_appeal_' . $request->decision,
            $app,
            "Appeal {$request->decision} for application #{$app->id}. Notes: {$request->notes}"
        );

        $app->user->notify(new ApplicationStatusNotification(
            $request->decision === 'approved' ? 'Appeal Approved' : 'Appeal Denied',
            $request->decision === 'approved'
                ? 'Your appeal has been approved and your application is back under review.'
                : 'Your appeal was not approved. Reason: ' . $request->notes
        ));

        return response()->json(['message' => 'Appeal ' . $request->decision . '.']);
    }

    public function retryOcr(\App\Models\ApplicationDocument $document)
    {
        $document->update(['status' => 'pending']);

        \App\Jobs\ProcessOcrDocument::dispatch(
            $document->application,
            $document,
            $document->file_path
        )->onQueue('ocr');

        return response()->json(['message' => 'OCR retry queued.']);
    }

    // Panel/demo use only (see ocr-service/app/routes.py's get_debug_mode) --
    // re-sends the document's ALREADY-STORED file to the OCR service with
    // debug=true, synchronously, and returns the result straight to the
    // caller. Deliberately does NOT touch $document/$application, does NOT
    // dispatch a queued job, and does NOT write any OcrResult/
    // VerificationCheck rows -- unlike retryOcr() above, this must never
    // affect the applicant's real reupload/attempt count or application
    // status, since it exists purely to let a verifier preview what the
    // full eligibility checks would have said even though an upload gate
    // (wrong type/year/name) already auto-rejected this document.
    public function previewDebugOcr(ApplicationDocument $document)
    {
        $storagePath = Storage::disk('local')->path($document->file_path);
        if (!file_exists($storagePath)) {
            return response()->json(['success' => false, 'error' => 'Stored file not found.'], 404);
        }

        $application = $document->application;
        $user        = $application->user;
        $config      = $application->configuration;
        $profile     = $user->profile;

        $multipart = [
            ['name' => 'file', 'contents' => fopen($storagePath, 'r'), 'filename' => $document->file_name],
            ['name' => 'first_name',  'contents' => $user->first_name],
            ['name' => 'middle_name', 'contents' => $user->middle_name ?? ''],
            ['name' => 'last_name',   'contents' => $user->last_name],
            ['name' => 'debug',       'contents' => 'true'],
        ];

        $endpoint = match ($document->document_type) {
            'voters_certificate' => '/api/ocr/voters-certificate',
            'registration_form'  => '/api/ocr/registration-form',
            'school_id'          => '/api/ocr/school-id',
        };

        if ($document->document_type === 'registration_form') {
            $multipart[] = ['name' => 'declared_school', 'contents' => $application->school_name];
            $multipart[] = ['name' => 'school_year',     'contents' => $config->school_year];
        }

        if ($document->document_type === 'school_id') {
            $multipart[] = ['name' => 'declared_school', 'contents' => $application->school_name];
        }

        if ($document->document_type === 'voters_certificate') {
            $isMinor = $profile?->is_minor ?? false;
            $multipart[] = ['name' => 'is_minor', 'contents' => $isMinor ? '1' : '0'];
            $multipart[] = ['name' => 'guardian_first_name',  'contents' => $profile?->guardian_first_name ?? ''];
            $multipart[] = ['name' => 'guardian_middle_name', 'contents' => $profile?->guardian_middle_name ?? ''];
            $multipart[] = ['name' => 'guardian_last_name',   'contents' => $profile?->guardian_last_name ?? ''];

            $schoolYearStart = (int) explode('-', $config->school_year)[0];
            $multipart[] = ['name' => 'enforce_cert_year', 'contents' => 'true'];
            $multipart[] = ['name' => 'cert_year', 'contents' => (string) $schoolYearStart];
        }

        $flaskUrl = env('OCR_SERVICE_URL', 'http://localhost:5000');
        $client = new Client(['timeout' => 180, 'connect_timeout' => 10]);

        try {
            $response = $client->post($flaskUrl . $endpoint, ['multipart' => $multipart]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'error' => 'OCR service unreachable: ' . $e->getMessage()], 502);
        }

        $result = json_decode($response->getBody()->getContents(), true);
        if (!is_array($result) || !isset($result['success'])) {
            return response()->json(['success' => false, 'error' => 'OCR service returned an unreadable response.'], 502);
        }

        $data = $result['verification'] ?? [];

        // Reshape into the same {check_name, passed, extracted_value,
        // expected_value, flag_reason, metadata} field names the frontend
        // already renders for real VerificationCheck rows (see
        // ProcessOcrDocument::handle()'s VerificationCheck::create() calls)
        // -- so the debug preview can reuse that same rendering, not a
        // one-off shape.
        $checks = [];
        foreach (($data['checks'] ?? []) as $checkName => $checkData) {
            if (!is_array($checkData)) continue;
            $checks[] = [
                'check_name'      => $checkName,
                'passed'          => $checkData['passed'] ?? false,
                'extracted_value' => $checkData['extracted'] ?? $checkData['raw'] ?? null,
                'expected_value'  => $checkData['expected'] ?? null,
                'flag_reason'     => $checkData['reason'] ?? null,
                'metadata'        => $checkData['metadata'] ?? null,
            ];
        }

        return response()->json([
            'success'             => true,
            'checks'              => $checks,
            'would_auto_reupload' => $data['would_auto_reupload'] ?? [],
            'avg_confidence'      => $result['avg_confidence'] ?? null,
            'ocr_lines'           => $result['ocr_lines'] ?? [],
        ]);
    }

    public function updateClaimStatus(Request $request, $id)
    {
        $request->validate([
            'claim_status'          => 'required|in:claimed,not_cleared',
            'reason_categories'     => 'required_if:claim_status,not_cleared|nullable|array',
            'reason_categories.*'   => 'string',
            'verified_documents'    => 'nullable|array',
            'notes'                 => 'nullable|string',
        ]);

        $assignment = ClaimingAssignment::where('application_id', $id)->with(['application.configuration', 'latestFaceVerification', 'lane'])->firstOrFail();

        // FIXED: this used to only check source IN ('waitlist_promotion',
        // 'late_claiming_retry') — but an applicant already visible in the
        // Late Claiming List because their lane day passed and Late
        // Claiming is open, while still technically source: 'original'
        // because the sweep hasn't formally reassigned them yet, was
        // slipping through this check entirely. That's exactly the same
        // eligibility question the Late Claiming List itself answers, so
        // this now uses the identical shared condition instead of a
        // narrower approximation that only covered two of the three
        // late-claiming cases.
        $today = now()->toDateString();
        $isLateClaiming = ClaimingAssignment::where('id', $assignment->id)
            ->where(fn($q) => $this->applyLateClaimingEligibleCondition($q, $today))
            ->exists();

        // Regular scheduled claiming is scoped to whichever lane the
        // applicant was assigned to — only THAT lane's verifier may mark
        // them claimed/not_cleared. Without this, any authenticated
        // verifier could update any applicant regardless of lane, and a
        // verifier who's only REQUESTED a staffed lane (self-assign
        // request pending admin approval — requested_verifier_id set but
        // verifier_id still someone else's) could act on it before that
        // approval ever happens. Late Claiming is deliberately exempt —
        // it's an unscheduled walk-in queue with no fixed lane-verifier
        // by design (see selfAssignLane()/claimingLanes() docblocks).
        if (!$isLateClaiming
            && (!$assignment->lane || $assignment->lane->verifier_id !== $request->user()->id)) {
            return response()->json([
                'message' => "You're not the assigned verifier for this applicant's lane.",
            ], 403);
        }

        // Late Claiming claims are unscheduled walk-ins with no lane/time
        // structure backing them up — face verification is the only real
        // proof of identity available, so it's required here. Regular
        // claiming already has a scheduled lane + control number + a verifier
        // who selected them off that lane's list, so it stays optional there.
        if ($isLateClaiming && $request->claim_status === 'claimed') {
            $lastFace = $assignment->latestFaceVerification;
            if (!$lastFace || !$lastFace->matched) {
                return response()->json([
                    'message' => 'Face verification must pass before this applicant can be marked Claimed during Late Claiming.',
                ], 400);
            }
        }

        $updateData = [
            'claim_status'       => $request->claim_status,
            'reason_categories'  => $request->claim_status === 'not_cleared' ? $request->reason_categories : null,
            'verified_documents' => $request->verified_documents ?? [],
            'verifier_notes'     => $request->notes,
            'verified_by'        => $request->user()->id,
            'verified_at'        => now(),
        ];

        // Snapshot the assistance amount at the moment of claiming, so this
        // record stays historically accurate even if the amount is changed
        // for a later period. Only set on the actual 'claimed' outcome —
        // not_cleared/unclaimed never disbursed anything, so no amount
        // applies to those.
        if ($request->claim_status === 'claimed') {
            $updateData['amount'] = $assignment->application->configuration->assistance_amount ?? 2000;
        }

        $assignment->update($updateData);

        $app = Application::with(['user', 'configuration'])->findOrFail($id);
        $previousStatus = $app->status;

        $app->update(['status' => $request->claim_status]);

        // Only not_cleared actually frees a slot for waitlist promotion —
        // that's the confirmed business rule. unclaimed does NOT decrement
        // slots_filled: the slot stays reserved for that no-show through
        // Late Claiming, exactly as intended. If they never show, the slot
        // simply goes unfilled for the cycle, not handed to the waitlist.
        if ($request->claim_status === 'not_cleared' && $previousStatus !== 'not_cleared') {
            $app->configuration()->decrement('slots_filled');
        }

        \App\Models\AuditLog::record(
            'claim_status_updated',
            $app,
            "Marked application #{$app->id} as {$request->claim_status}"
        );

        // 'unclaimed' intentionally not a key here — this method's own
        // validation only ever allows 'claimed'/'not_cleared' as input.
        // 'unclaimed' is exclusively set by SweepUnclaimedAssignments,
        // never through this endpoint.
        $messages = [
            'claimed'     => 'You have successfully claimed your educational assistance. Thank you!',
            'not_cleared' => 'Your physical documents did not match your application record on claiming day. Please contact the SK office for further assistance.',
        ];
        $labels = [
            'claimed'     => 'Claimed',
            'not_cleared' => 'Rejected — Document Mismatch at Claiming',
        ];

        $app->user->notify(new ApplicationStatusNotification(
            $labels[$request->claim_status],
            $messages[$request->claim_status]
        ));

        return response()->json(['message' => 'Claiming status updated.', 'assignment' => $assignment]);
    }

    public function searchClaiming(Request $request)
    {
        $controlNumber = $request->query('control_number');
        $name          = $request->query('name');
        $laneId        = $request->query('lane_id');
        $lateClaiming  = $request->boolean('late_claiming');
        $today         = now()->toDateString();

        // Scoped to the ACTIVE application period only. Without this,
        // any historical applicant from any past, already-closed cycle
        // bleeds into whatever's currently being viewed — a genuinely
        // finalized 'unclaimed' from a period that ended months ago
        // would otherwise appear mixed into today's active Late Claiming
        // List with no indication it belongs to a different period at
        // all, misleadingly suggesting it happened during the CURRENT
        // still-open Late Claiming window.
        $activeConfig = ApplicationConfiguration::where('is_active', true)->first();
        if (!$activeConfig) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        $query = Application::with(['user', 'documents', 'claimingAssignment.lane', 'claimingAssignment.verifier'])
            ->where('config_id', $activeConfig->id)
            ->whereIn('status', ['approved', 'claimed', 'not_cleared', 'unclaimed'])
            ->whereHas('claimingAssignment');

        if ($lateClaiming) {
            $query->whereHas('claimingAssignment', fn($q) => $this->applyLateClaimingEligibleCondition($q, $today));
        } else {
            // Scheduled Claiming NEVER shows anyone currently late-claiming-
            // eligible — once someone's overdue into the late-claiming
            // window, they belong exclusively on that tab from then on.
            // What's left here is: still-active pending applicants (haven't
            // hit their day yet, or it's today and Late Claiming hasn't
            // started), plus resolved outcomes (claimed/not_cleared) kept
            // visible as a same-day history/reference check.
            $query->whereDoesntHave('claimingAssignment', fn($q) => $this->applyLateClaimingEligibleCondition($q, $today));

            if ($laneId) {
                // Scheduled claiming day — scoped to one specific lane, so a
                // verifier only ever sees the applicants assigned to the
                // lane they're actually working. Verified against the
                // CURRENT user's own assignment, not just whatever lane_id
                // was passed in — otherwise a verifier could browse any
                // lane's list by ID alone, including one they've only
                // REQUESTED (self-assign pending admin approval) or one
                // that belongs to someone else entirely.
                $lane = \App\Models\ClaimingLane::find($laneId);
                if (!$lane || $lane->verifier_id !== $request->user()->id) {
                    return response()->json(['message' => 'You are not assigned to that lane.'], 403);
                }
                $query->whereHas('claimingAssignment', fn($q) => $q->where('claiming_lane_id', $laneId));
            }
        }

        if ($controlNumber) {
            $query->where('control_number', 'like', "%{$controlNumber}%");
        }
        if ($name) {
            $query->whereHas('user', function ($q) use ($name) {
                $q->where('first_name', 'like', "%{$name}%")
                ->orWhere('last_name', 'like', "%{$name}%");
            });
        }

        $results = $query->get();
        if ($results->isEmpty()) {
            return response()->json(['message' => 'No matching approved applicant found.'], 404);
        }
        return response()->json($results);
    }

    /**
     * Returns the logged-in verifier's currently assigned lane (if any —
     * whether set by an admin or previously self-picked), plus the full
     * list of today's lanes so they can self-assign or switch if plans
     * change. This is what lets VerifierClaiming.jsx default straight to
     * "my lane's applicants" instead of requiring a broad search every
     * time.
     */
    public function claimingLanes(Request $request)
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            return response()->json(['assigned_lane' => null, 'assigned_lanes' => [], 'all_lanes' => []]);
        }

        $schedule = \App\Models\ClaimingSchedule::where('config_id', $config->id)
            ->where('is_active', true)
            ->latest()
            ->first();

        if (!$schedule) {
            return response()->json(['assigned_lane' => null, 'assigned_lanes' => [], 'all_lanes' => []]);
        }

        $allLanes = $schedule->lanes()
            ->where('lane_name', '!=', 'Late Claiming')
            ->orderBy('claiming_date')
            ->orderBy('lane_name')
            ->get(['id', 'lane_name', 'batch', 'claiming_date', 'verifier_id', 'requested_verifier_id']);

        // A verifier can legitimately hold more than one lane at once (one
        // per claiming_date + batch session — e.g. a morning lane AND a
        // separate afternoon lane on the same day, see selfAssignLane()).
        // `assigned_lane` below is kept only for whatever still reads it
        // as a single value; `assigned_lanes` is the full set and is what
        // the frontend uses to correctly tell "my other lane" apart from
        // "someone else's lane".
        $assignedLanes = $allLanes->where('verifier_id', $request->user()->id)->values();
        $assignedLane = $assignedLanes->first();

        return response()->json([
            'assigned_lane'         => $assignedLane,
            'assigned_lanes'        => $assignedLanes,
            'all_lanes'             => $allLanes,
            // So the frontend can auto-default to whichever mode actually
            // matches today, instead of always opening on Scheduled Claiming
            // regardless of what day it is.
            'late_claiming_date'     => $schedule->late_claiming_date,
            'late_claiming_end_date' => $schedule->late_claiming_end_date,
        ]);
    }

    /**
     * Verifier picks a lane. If nobody's currently on it, this assigns it
     * to them immediately — same one-lane-per-verifier swap as before,
     * clearing them off any other lane in this schedule first. There's no
     * one to displace, so no approval is needed.
     *
     * If the lane already has a DIFFERENT verifier, this used to reassign
     * it immediately anyway — which let one verifier silently bump another
     * off their lane with no warning (two people clicking this on the same
     * station within seconds of each other would just keep stealing it
     * back and forth). In that case it now only records a REQUEST; an
     * admin has to approve it via AdminScheduleController::assignVerifier()
     * before it actually takes effect, so taking over an already-staffed
     * lane stays a deliberate, visible decision.
     */
    public function selfAssignLane(Request $request, $laneId)
    {
        $lane = \App\Models\ClaimingLane::findOrFail($laneId);

        if ($lane->verifier_id === $request->user()->id) {
            return response()->json(['message' => "You're already assigned to {$lane->lane_name}."], 400);
        }

        if ($lane->verifier_id === null) {
            // Scoped to the same claiming_date + batch (morning/afternoon)
            // — a verifier can legitimately staff one lane in the morning
            // and another in the afternoon, or lanes on different days, so
            // only the same-session lane should be vacated here.
            \App\Models\ClaimingLane::where('claiming_schedule_id', $lane->claiming_schedule_id)
                ->where('claiming_date', $lane->claiming_date)
                ->where('batch', $lane->batch)
                ->where('verifier_id', $request->user()->id)
                ->update(['verifier_id' => null]);

            $lane->update(['verifier_id' => $request->user()->id, 'requested_verifier_id' => null]);

            return response()->json([
                'message' => "You're now assigned to {$lane->lane_name}.",
                'lane'    => $lane,
            ]);
        }

        $lane->update(['requested_verifier_id' => $request->user()->id]);

        return response()->json([
            'message' => "{$lane->lane_name} already has a verifier. Request sent — an admin needs to approve it before it becomes your lane.",
            'lane'    => $lane,
        ]);
    }

    // Returns the logged-in verifier's own activity history
    public function activityLog(Request $request)
    {
        $logs = \App\Models\AuditLog::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }
}