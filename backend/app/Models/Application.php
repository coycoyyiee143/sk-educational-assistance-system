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