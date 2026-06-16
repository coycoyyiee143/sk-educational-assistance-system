<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerifierAction extends Model
{
    protected $fillable = [
        'application_id',
        'verifier_id',
        'action',
        'notes',
        'reupload_details',
    ];

    protected $casts = [
        'reupload_details' => 'array',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function verifier()
    {
        return $this->belongsTo(User::class, 'verifier_id');
    }
}