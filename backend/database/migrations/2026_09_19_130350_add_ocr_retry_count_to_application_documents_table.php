<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Tracks how many times the scheduled auto-retry (RetryFailedOcrDocuments)
// has re-dispatched a failed document, so it can give up after a few
// attempts instead of endlessly re-queuing a document that's genuinely
// broken (bad file, unsupported format) rather than just unlucky timing
// (OCR service briefly down/congested). A manual "Retry OCR" click from
// the verifier UI is unaffected — it doesn't touch this counter.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->unsignedTinyInteger('ocr_retry_count')->default(0)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn('ocr_retry_count');
        });
    }
};
