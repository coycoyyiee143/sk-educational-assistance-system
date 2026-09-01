<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            // Distinguishes WHY a document was auto-flagged, so the cap
            // logic can apply differently per category: 'low_quality'
            // (blurry/unreadable) is never capped — repeated bad photos
            // aren't necessarily something the applicant can fix faster
            // by trying again. 'wrong_document_type' and 'wrong_cert_year'
            // ARE capped at 3 attempts — repeated confusion or a
            // genuinely outdated document is worth a human's attention
            // after a few tries, not an endless auto-loop.
            $table->string('auto_reupload_category')->nullable()->after('auto_reupload_reason');
        });
    }

    public function down(): void
    {
        Schema::table('application_documents', function (Blueprint $table) {
            $table->dropColumn('auto_reupload_category');
        });
    }
};