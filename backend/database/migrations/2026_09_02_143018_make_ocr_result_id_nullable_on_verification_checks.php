<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('verification_checks', function (Blueprint $table) {
            // The 3-attempt escalation check (repeated_auto_reupload_escalation)
            // is a SYNTHETIC row summarizing repeated auto-reupload attempts —
            // it has no single OCR run behind it (the whole point is that it
            // fires AFTER the deep OCR checks never ran, since every attempt
            // short-circuited at the upload-check stage). This column was
            // originally NOT NULL, since every other check in this system is
            // always tied to a real OcrResult — this is the first exception.
            $table->foreignId('ocr_result_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('verification_checks', function (Blueprint $table) {
            $table->foreignId('ocr_result_id')->nullable(false)->change();
        });
    }
};