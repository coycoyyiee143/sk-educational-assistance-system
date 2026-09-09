<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'auditable_type',
        'auditable_id',
        'description',
        'ip_address',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Record an audit log entry.
     *
     * For authenticated actions, the current authenticated user
     * is automatically used.
     *
     * For public actions such as Forgot Password, an explicit
     * user can be provided through the fourth parameter.
     *
     * Examples:
     *
     * AuditLog::record(
     *     'application_approved',
     *     $application,
     *     'Application approved'
     * );
     *
     * AuditLog::record(
     *     'password_reset',
     *     $user,
     *     'Password was reset using Forgot Password',
     *     $user
     * );
     */
    public static function record(
        string $action,
        $subject = null,
        ?string $description = null,
        ?User $actor = null
    ): self {
        return self::create([
            'user_id'        => $actor?->id ?? Auth::id(),
            'action'         => $action,
            'auditable_type' => $subject ? get_class($subject) : null,
            'auditable_id'   => $subject?->id,
            'description'    => $description,
            'ip_address'     => Request::ip(),
        ]);
    }
}