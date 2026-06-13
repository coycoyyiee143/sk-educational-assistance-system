<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    protected $fillable = [
        'user_id',
        'config_id',
        'control_number',
        'school_name',
        'school_address',
        'course',
        'year_level',
        'student_id_number',
        'status',
        'rejection_reason',
        'submitted_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function configuration()
    {
        return $this->belongsTo(ApplicationConfiguration::class, 'config_id');
    }

    public function documents()
    {
        return $this->hasMany(ApplicationDocument::class)->orderBy('version', 'desc');
    }

    public function verificationChecks()
    {
        return $this->hasMany(VerificationCheck::class);
    }

    public function verifierActions()
    {
        return $this->hasMany(VerifierAction::class);
    }

    public function latestVerifierAction()
    {
        return $this->hasOne(VerifierAction::class)->latestOfMany();
    }
}