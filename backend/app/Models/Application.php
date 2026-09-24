<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\DB;

class Application extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'config_id',
        'control_number',
        'school_name',
        'school_address',
        'course',
        'year_level',
        'student_id_number',
        'status',
        'rejection_reason',
        'appeal_reason',
        'appeal_document_path',
        'appealed_at',
        'appeal_decision_notes',
        'appeal_decided_at',
        'submitted_at',
        'waitlisted_at',
        'attestation_accepted_at',
        'viewing_verifier_id',
        'viewing_heartbeat_at',
    ];

    protected $casts = [
        'submitted_at'  => 'datetime',
        'waitlisted_at' => 'datetime',
        'attestation_accepted_at' => 'datetime',
        'appealed_at' => 'datetime',
        'appeal_decided_at' => 'datetime',
        'viewing_heartbeat_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function viewingVerifier()
    {
        return $this->belongsTo(User::class, 'viewing_verifier_id');
    }

    public function configuration()
    {
        return $this->belongsTo(ApplicationConfiguration::class, 'config_id');
    }

    public function documents()
    {
        return $this->hasMany(ApplicationDocument::class)->orderBy('version', 'desc');
    }

    public function verificationChecks()
    {
        return $this->hasMany(VerificationCheck::class);
    }

    public function verifierActions()
    {
        return $this->hasMany(VerifierAction::class);
    }

    public function latestVerifierAction()
    {
        return $this->hasOne(VerifierAction::class)->latestOfMany();
    }

    public function claimingAssignment()
    {
        return $this->hasOne(ClaimingAssignment::class);
    }

    /**
     * Atomically approves an application: checks the slot limit, assigns a
     * control number scoped to this period, flips status, and increments
     * slots_filled — all inside one locked transaction. Returns a structured
     * result so callers can distinguish "already approved" from "no slots
     * left" and react accordingly.
     */
    public static function tryApprove(self $application): array
    {
        // Retries a handful of times on a control_number collision — belt
        // and suspenders alongside the MAX-based sequence below, in case
        // some other process ever inserts a number out from under this
        // locked transaction.
        for ($attempt = 0; $attempt < 5; $attempt++) {
            try {
                return DB::transaction(function () use ($application) {
                    $app = self::where('id', $application->id)->lockForUpdate()->first();

                    if ($app->status === 'approved') {
                        return ['result' => 'already_approved', 'control_number' => $app->control_number];
                    }

                    $config = ApplicationConfiguration::where('id', $app->config_id)
                        ->lockForUpdate()
                        ->first();

                    if (!$config->is_unlimited && $config->slots_filled >= $config->slot_limit) {
                        return ['result' => 'no_slots', 'control_number' => null];
                    }

                    $year = $config->open_date?->format('Y') ?? now()->year;
                    $prefix = 'SK-' . $year . '-';

                    // MAX-based rather than count-based: a count undercounts
                    // the next free number whenever the sequence has gaps
                    // (e.g. a control number reused after a reversal, or
                    // seeded data), which previously produced duplicate
                    // control numbers under concurrent approvals.
                    $maxSequence = (int) self::where('config_id', $config->id)
                        ->where('control_number', 'like', $prefix . '%')
                        ->selectRaw("MAX(CAST(SUBSTRING(control_number, ?) AS UNSIGNED)) as max_seq", [strlen($prefix) + 1])
                        ->value('max_seq');

                    $controlNumber = $prefix . str_pad($maxSequence + 1, 4, '0', STR_PAD_LEFT);

                    $app->update(['status' => 'approved', 'control_number' => $controlNumber]);
                    $config->increment('slots_filled');

                    return ['result' => 'approved', 'control_number' => $controlNumber];
                });
            } catch (\Illuminate\Database\QueryException $e) {
                $isDuplicate = str_contains($e->getMessage(), 'control_number_unique')
                    || (int) ($e->errorInfo[1] ?? 0) === 1062;

                if (!$isDuplicate || $attempt === 4) {
                    throw $e;
                }
            }
        }
    }

    /**
     * Moves a qualified-but-unslotted application onto the waitlist.
     */
    public static function moveToWaitlist(self $application): void
    {
        $application->update([
            'status'        => 'waitlisted',
            'waitlisted_at' => now(),
        ]);
    }

    /**
     * Recomputes and applies an application's status from its documents'
     * current OCR/verification results. Shared by ProcessOcrDocument (called
     * after each document finishes processing) and any caller that needs to
     * reconcile status without re-running OCR — e.g. a seeder that skips
     * creating a document because it already exists, and therefore never
     * triggers the job that would otherwise call this. Safe to call at any
     * time: it's a no-op (returns early) until all three required document
     * types are 'processed'.
     */
    public static function refreshStatusFromDocuments(self $application): void
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
            $routing = new \App\Services\DocumentReuploadRoutingService();

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


            $application->user->notify(new \App\Notifications\ApplicationStatusNotification(
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


        $outcome = self::tryApprove($application);


        if ($outcome['result'] === 'no_slots') {
            // Passed every automated check — genuinely qualified, just
            // arrived after the cap. Waitlisted rather than dropped or sent
            // to manual review, since a verifier reviewing this wouldn't
            // find anything to decide: the checks already passed.
            self::moveToWaitlist($application);


            $application->user->notify(new \App\Notifications\ApplicationStatusNotification(
                'Waitlisted',
                "Your application met all requirements, but all slots for this period are currently filled. This does not guarantee a slot — you will only be approved if a slot opens up. If a slot opens, we will notify you before Late Claiming ends."
            ));
            return;
        }


        $application->update(['auto_reupload_reason' => null]);


        // Trigger Automated System Approval Notification
        $application->user->notify(new \App\Notifications\ApplicationStatusNotification(
            'Approved',
            'Congratulations! Your application has been approved. Please prepare your physical documents for submission and stay tuned for further instructions.'
        ));
    }

    /**
     * Attempts to promote the longest-waiting waitlisted applicant for a
     * period. Returns a structured result — ['result' => 'no_waitlist' |
     * 'no_slots' | 'approved', 'application' => Application|null] — so
     * callers can distinguish "nobody's waitlisted" from "someone's
     * waitlisted but no room" and react with the correct message. Always
     * returns this shape; never a bare Application or null.
     */
    public static function promoteNextFromWaitlist(int $configId): array
    {
        $next = self::where('config_id', $configId)
            ->where('status', 'waitlisted')
            ->orderBy('waitlisted_at')
            ->first();

        if (!$next) {
            return ['result' => 'no_waitlist', 'application' => null];
        }

        $outcome = self::tryApprove($next);

        if ($outcome['result'] !== 'approved') {
            return ['result' => 'no_slots', 'application' => null];
        }

        return ['result' => 'approved', 'application' => $next->fresh()];
    }

    /**
     * Promotes as many waitlisted applicants as current slot availability
     * allows, in strict FIFO order. Stops as soon as promoteNextFromWaitlist
     * reports anything other than 'approved'.
     */
    public static function promoteAllFromWaitlist(int $configId): array
    {
        $promoted = [];

        while (true) {
            $outcome = self::promoteNextFromWaitlist($configId);
            if ($outcome['result'] !== 'approved') {
                break;
            }
            $promoted[] = $outcome['application'];
        }

        return $promoted;
    }
}