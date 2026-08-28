<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FaceVerification extends Model
{
    protected $fillable = [
        'user_id',
        'id_image_path',
        'live_photo_path',
        'face_embedding',
        'registration_match_score',
        'status',
        'verified_at',
        'claiming_photo_path',
        'claiming_match_score',
        'claiming_status',
        'claiming_verified_at',
    ];

    protected $casts = [
        'face_embedding'        => 'array',
        'verified_at'           => 'datetime',
        'claiming_verified_at'  => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}