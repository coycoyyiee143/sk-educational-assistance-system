<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClaimingSchedule extends Model
{
    protected $fillable = [
        'config_id',
        'location',
        'morning_start',
        'morning_end',
        'afternoon_start',
        'afternoon_end',
        'grace_period_date',
        'grace_period_end_date',
        'is_published',
        'published_at',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function configuration()
    {
        return $this->belongsTo(ApplicationConfiguration::class, 'config_id');
    }

    public function lanes()
    {
        return $this->hasMany(ClaimingLane::class);
    }

    public function assignments()
    {
        return $this->hasMany(ClaimingAssignment::class);
    }
}