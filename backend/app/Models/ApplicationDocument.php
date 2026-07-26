<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ApplicationDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'application_id',
        'document_type',
        'file_path',
        'file_name',
        'mime_type',
        'version',
        'status',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function ocrResult()
    {
        return $this->hasOne(OcrResult::class, 'document_id');
    }

    public function verificationChecks()
    {
        return $this->hasMany(VerificationCheck::class, 'document_id');
    }
}