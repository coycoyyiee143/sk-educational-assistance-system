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
     * Convenience helper for recording an audit log entry.
     *
     * Usage:
     *   AuditLog::record('application_approved', $app, "Approved application #{$app->id}");
     *   AuditLog::record('visited_dashboard'); // no subject needed for page visits
     *
     * @param string $action A short machine-readable label
     * @param \Illuminate\Database\Eloquent\Model|null $subject The model this action relates to
     * @param string|null $description Human-readable summary
     */
    public static function record(string $action, $subject = null, ?string $description = null): self
    {
        return self::create([
            'user_id'        => Auth::id(),
            'action'         => $action,
            'auditable_type' => $subject ? get_class($subject) : null,
            'auditable_id'   => $subject?->id,
            'description'    => $description,
            'ip_address'     => Request::ip(),
        ]);
    }
}