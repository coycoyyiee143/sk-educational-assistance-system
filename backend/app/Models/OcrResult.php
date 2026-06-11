<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OcrResult extends Model
{
    protected $fillable = [
        'document_id',
        'extracted_fields',
        'confidence_score',
        'is_low_confidence',
        'raw_text',
    ];

    protected $casts = [
        'extracted_fields' => 'array',
        'is_low_confidence' => 'boolean',
    ];

    public function document()
    {
        return $this->belongsTo(ApplicationDocument::class, 'document_id');
    }

    public function verificationChecks()
    {
        return $this->hasMany(VerificationCheck::class, 'ocr_result_id');
    }
}