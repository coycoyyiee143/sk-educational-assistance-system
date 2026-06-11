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
        'barangay',
        'city',
        'province',
        'guardian_name',
        'guardian_relationship',
        'guardian_contact',
        'is_profile_complete',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'is_profile_complete' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}