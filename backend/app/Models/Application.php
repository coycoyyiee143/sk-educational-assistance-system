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
        'waitlisted_at',
    ];

    protected $casts = [
        'submitted_at'  => 'datetime',
        'waitlisted_at' => 'datetime',
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
     * slots_filled — all inside one locked transaction. Returns a structured
     * result so callers can distinguish "already approved" from "no slots
     * left" and react accordingly.
     */
    public static function tryApprove(self $application): array
    {
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