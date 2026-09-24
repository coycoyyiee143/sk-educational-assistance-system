<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TwoFactorResetRequest extends Model
{
    protected $fillable = [
        'user_id',
        'status',
        'ip_address',
        'resolved_by_id',
        'resolved_at',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function resolvedBy()
    {
        return $this->belongsTo(User::class, 'resolved_by_id');
    }
}
