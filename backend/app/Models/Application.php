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
        'submitted_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
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
     * slots_filled — all inside one locked transaction. Both the manual
     * verifier approval and the OCR auto-approval path call this same
     * method, so there's exactly one place slot checking and numbering can
     * happen, instead of two paths that could disagree or race each other.
     *
     * Returns a structured result so callers can distinguish "already
     * approved" from "no slots left" and react accordingly — the latter
     * should waitlist, not fail silently or duplicate-approve.
     */
    public static function tryApprove(self $application): array
    {
        return DB::transaction(function () use ($application) {
            $app = self::where('id', $application->id)->lockForUpdate()->first();

            if ($app->status === 'approved') {
                return ['result' => 'already_approved', 'control_number' => $app->control_number];
            }

            // Locking this row is what actually prevents the race: a second
            // concurrent approval for the same period blocks here until this
            // transaction commits, so the slot check below and the sequence
            // count further down can never run for two approvals at once.
            $config = ApplicationConfiguration::where('id', $app->config_id)
                ->lockForUpdate()
                ->first();

            if (!$config->is_unlimited && $config->slots_filled >= $config->slot_limit) {
                return ['result' => 'no_slots', 'control_number' => null];
            }

            $sequence = self::where('config_id', $config->id)
                ->whereNotNull('control_number')
                ->count() + 1;

            $year = $config->open_date?->format('Y') ?? now()->year;
            $controlNumber = 'SK-' . $year . '-' . str_pad($sequence, 4, '0', STR_PAD_LEFT);

            $app->update(['status' => 'approved', 'control_number' => $controlNumber]);
            $config->increment('slots_filled');

            return ['result' => 'approved', 'control_number' => $controlNumber];
        });
    }

    /**
     * Moves a qualified-but-unslotted application onto the waitlist. Called
     * when tryApprove() returns 'no_slots' — the applicant passed every
     * eligibility check (auto or verifier-confirmed) but arrived after the
     * cap was reached. waitlisted_at orders the backfill queue fairly, in
     * the order applicants became qualified, not submission order.
     */
    public static function moveToWaitlist(self $application): void
    {
        $application->update([
            'status'        => 'waitlisted',
            'waitlisted_at' => now(),
        ]);
    }

    /**
     * Promotes the longest-waiting applicant on a period's waitlist into an
     * approved slot — used when a claiming-day rejection (not_cleared)
     * frees a slot during grace period, triggered manually by a
     * verifier/admin. Reuses tryApprove() so a promoted applicant goes
     * through the identical slot-check + numbering logic as any other
     * approval, keeping control numbers strictly sequential regardless of
     * which path approved someone.
     */
    public static function promoteNextFromWaitlist(int $configId): ?self
    {
        $next = self::where('config_id', $configId)
            ->where('status', 'waitlisted')
            ->orderBy('waitlisted_at')
            ->first();

        if (!$next) {
            return null;
        }

        $outcome = self::tryApprove($next);

        return $outcome['result'] === 'approved' ? $next->fresh() : null;
    }
}