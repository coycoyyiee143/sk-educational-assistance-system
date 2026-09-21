<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClaimingLane extends Model
{
    protected $fillable = [
        'claiming_schedule_id',
        'lane_name',
        'capacity',
        'batch',
        'claiming_date',
        'verifier_id',
        'requested_verifier_id',
    ];

    public function schedule()
    {
        return $this->belongsTo(ClaimingSchedule::class, 'claiming_schedule_id');
    }

    public function assignments()
    {
        return $this->hasMany(ClaimingAssignment::class);
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verifier_id');
    }

    public function requestedVerifier()
    {
        return $this->belongsTo(User::class, 'requested_verifier_id');
    }

    /**
     * Just the zero-padded sequence portion (e.g. "0001-0100"), not the
     * full "SK-2026-0001" string -- that's already shown per-applicant
     * elsewhere, so repeating the "SK-{year}-" prefix on every lane row
     * here would just be noise. Reads the last 4 characters rather than
     * splitting on "-", so it doesn't care how many prefix segments a
     * given control number has (plain "SK-2026-0001" vs a demo seeder's
     * "SK-CDTEST-2026-0001").
     *
     * Requires the 'assignments.application' relation to already be
     * eager-loaded (and this attribute explicitly ->append()'ed) by the
     * caller -- deliberately NOT in $appends, so lanes returned from
     * contexts that never load that relation don't pay for an N+1 query
     * just to serialize this one field.
     */
    public function getControlNumberRangeAttribute(): ?string
    {
        if (!$this->relationLoaded('assignments')) {
            return null;
        }

        $numbers = $this->assignments
            ->pluck('application.control_number')
            ->filter()
            ->map(fn ($cn) => (int) substr($cn, -4))
            ->sort();

        if ($numbers->isEmpty()) {
            return null;
        }

        $min = str_pad((string) $numbers->first(), 4, '0', STR_PAD_LEFT);
        $max = str_pad((string) $numbers->last(), 4, '0', STR_PAD_LEFT);

        return $min === $max ? $min : "{$min}-{$max}";
    }
}