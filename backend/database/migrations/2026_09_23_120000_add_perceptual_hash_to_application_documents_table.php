<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            // 16-char hex dHash from the OCR service (app/upload_checks/perceptual_hash.py).
            // Indexed for the duplicate-submission lookup in ProcessOcrDocument --
            // an exact match is cheap via the index; near-duplicates (Hamming
            // distance) are checked in PHP against that same narrowed set.
            $table->string('perceptual_hash', 16)->nullable()->after('mime_type')->index();
        });
    }

    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn('perceptual_hash');
        });
    }
};
