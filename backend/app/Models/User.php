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

        // Generate a fresh random token for the link. This automatically
        // invalidates any previously sent link, since only the latest
        // token stored on the user record will match.
        $token = \Illuminate\Support\Str::random(64);

        // Generate a fresh 6-digit fallback code, for cases where the
        // applicant opens the email on a different device than the one
        // they're verifying on (e.g. email on phone, browser on desktop)
        $code = (string) random_int(100000, 999999);

        $this->forceFill([
            'verification_token'            => $token,
            'verification_token_expires_at' => now()->addMinutes(60),
            'verification_code'             => $code,
            'verification_code_expires_at'  => now()->addMinutes(15),
        ])->save();

        $verificationUrl = $frontendUrl . '/verify-email/' . $this->id . '/' . $token;

        // Dispatch the custom notification template
        $this->notify(new CustomVerifyEmailNotification($verificationUrl, $code));
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