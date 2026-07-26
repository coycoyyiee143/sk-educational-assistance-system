<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Laravel\Sanctum\HasApiTokens;
use App\Notifications\CustomVerifyEmailNotification;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasFactory, HasApiTokens, Notifiable;

    protected $fillable = [
        'first_name',
        'middle_name',
        'last_name',
        'email',
        'mobile_number',
        'password',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    /**
     * Override the default method to send a frontend-friendly verification link.
     */
    public function sendEmailVerificationNotification()
    {
        // Fallback to localhost:3000 if FRONTEND_URL is not defined in your .env file
        $frontendUrl = env('FRONTEND_URL', 'http://localhost:3000');
        
        // Matches the structure expected by your React routing system
        $verificationUrl = $frontendUrl . '/verify-email/' . $this->id . '/' . sha1($this->email);

        // Dispatch the custom notification template
        $this->notify(new CustomVerifyEmailNotification($verificationUrl));
    }

    public function profile()
    {
        return $this->hasOne(StudentProfile::class);
    }

    public function applications()
    {
        return $this->hasMany(Application::class);
    }
}