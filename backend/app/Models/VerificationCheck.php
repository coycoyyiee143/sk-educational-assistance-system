<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VerificationCheck extends Model
{
    protected $fillable = [
        'application_id',
        'document_id',
        'ocr_result_id',
        'check_name',
        'passed',
        'extracted_value',
        'expected_value',
        'flag_reason',
        'metadata',
    ];

    protected $casts = [
        'passed'   => 'boolean',
        'metadata' => 'array',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }

    public function document()
    {
        return $this->belongsTo(ApplicationDocument::class, 'document_id');
    }

    public function ocrResult()
    {
        return $this->belongsTo(OcrResult::class, 'ocr_result_id');
    }
}