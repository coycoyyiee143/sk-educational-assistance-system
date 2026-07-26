<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ApplicationConfiguration extends Model
{
    use HasFactory;
    
    protected $fillable = [
        'school_year',
        'open_date',
        'close_date',
        'slot_limit',
        'slots_filled',
        'is_unlimited',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'open_date'    => 'datetime',
        'close_date'   => 'datetime',
        'is_active'    => 'boolean',
        'is_unlimited' => 'boolean',
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