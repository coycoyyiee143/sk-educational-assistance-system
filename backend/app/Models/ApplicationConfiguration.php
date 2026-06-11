<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApplicationConfiguration extends Model
{
    protected $fillable = [
        'school_year',
        'semester',
        'open_date',
        'close_date',
        'total_slots',
        'used_slots',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'open_date' => 'date',
        'close_date' => 'date',
        'is_active' => 'boolean',
    ];

    public function applications()
    {
        return $this->hasMany(Application::class, 'config_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}