<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClaimingFaceVerification extends Model
{
    protected $fillable = [
        'claiming_assignment_id',
        'verified_by',
        'claiming_photo_path',
        'match_score',
        'matched',
        'verified_at',
    ];

    protected $casts = [
        'matched'     => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function assignment()
    {
        return $this->belongsTo(ClaimingAssignment::class, 'claiming_assignment_id');
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}