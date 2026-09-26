<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StudentProfile extends Model
{
    protected $fillable = [
        'user_id',
        'birthdate',
        'gender',
        'civil_status',
        'house_no',
        'street',
        'purok',
        'purok_type',
        'subdivision',
        'barangay',
        'city',
        'province',
        'guardian_first_name',
        'guardian_middle_name',
        'guardian_last_name',
        'guardian_relationship',
        'guardian_contact',
        'is_profile_complete',
    ];

    protected $casts = [
        'birthdate' => 'date:Y-m-d',
        'is_profile_complete' => 'boolean',
    ];

    // Ensures is_minor and is_barangay_resident are always included when
    // this model is serialized to JSON, so frontend code (verifier review,
    // etc.) can use them directly without recomputing.
    protected $appends = ['is_minor', 'is_barangay_resident', 'is_age_ineligible'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function getIsMinorAttribute(): ?bool
    {
        if (!$this->birthdate) {
            return null;
        }
        return $this->birthdate->age < 18;
    }

    // Derived from the same barangay field used for the address section.
    // This is only a soft/informational signal; the authoritative check
    // happens against the Voter's Certificate (residency_geofence in
    // voters_cert.py).
    public function getIsBarangayResidentAttribute(): ?bool
    {
        if (!$this->barangay) {
            return null;
        }
        return strtolower(trim($this->barangay)) === 'mamatid';
    }

    // SK youth bracket is 17-30. Computed live off birthdate (same
    // approach as is_minor above) rather than a stored flag that a
    // scheduled job would need to keep in sync — this way the cutoff is
    // always exact, including the day of the 31st birthday itself, with
    // no cron/drift to worry about.
    public function getIsAgeIneligibleAttribute(): ?bool
    {
        if (!$this->birthdate) {
            return null;
        }
        return $this->birthdate->age >= 31;
    }

    public function hasCompleteGuardianInfo(): bool
    {
        return (bool) ($this->guardian_first_name && $this->guardian_last_name && $this->guardian_relationship);
    }
}