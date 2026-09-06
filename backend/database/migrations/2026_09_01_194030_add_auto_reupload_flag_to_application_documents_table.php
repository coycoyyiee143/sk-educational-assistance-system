<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            // Set true when this document was auto-flagged by the OCR
            // pipeline's upload-check stage (wrong document type, too
            // low quality, or a confidently-wrong cert year) — checked
            // BEFORE the deeper field-by-field verification runs. Never
            // set by a human verifier; ProcessOcrDocument.php sets this
            // directly from the Python service's response.
            $table->boolean('needs_auto_reupload')->default(false)->after('status');

            // Applicant-facing explanation of what was wrong, shown on
            // the reupload screen. No VerifierAction exists for this
            // case (no human involved), so this can't come from
            // reupload_details the way the human-initiated reupload
            // flow does — it has to live directly on the document.
            $table->text('auto_reupload_reason')->nullable()->after('needs_auto_reupload');
        });
    }

    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn(['needs_auto_reupload', 'auto_reupload_reason']);
        });
    }
};