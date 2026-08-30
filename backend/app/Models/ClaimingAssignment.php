<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClaimingAssignment extends Model
{
    protected $fillable = [
        'application_id',
        'claiming_schedule_id',
        'claiming_lane_id',
        'claim_status',
        'amount',
        'source',
        'reason_categories',
        'verified_documents',
        'verifier_notes',
        'verified_by',
        'verified_at',
        'reminder_sent_at',
    ];

    protected $casts = [
        'reason_categories'   => 'array',
        'verified_documents'  => 'array',
        'verified_at'         => 'datetime',
        'reminder_sent_at'    => 'datetime',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function schedule()
    {
        return $this->belongsTo(ClaimingSchedule::class, 'claiming_schedule_id');
    }

    public function lane()
    {
        return $this->belongsTo(ClaimingLane::class, 'claiming_lane_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function faceVerifications()
    {
        return $this->hasMany(ClaimingFaceVerification::class);
    }

    // Most recent attempt for this assignment — what the UI and the
    // claimed-gate check against.
    public function latestFaceVerification()
    {
        return $this->hasOne(ClaimingFaceVerification::class)->latestOfMany();
    }
}