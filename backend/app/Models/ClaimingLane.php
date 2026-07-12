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
    ];

    public function schedule()
    {
        return $this->belongsTo(ClaimingSchedule::class, 'claiming_schedule_id');
    }

    public function assignments()
    {
        return $this->hasMany(ClaimingAssignment::class);
    }
}