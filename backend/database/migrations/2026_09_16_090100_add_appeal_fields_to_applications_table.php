<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            // Set when an applicant formally appeals a 'rejected' application
            // (ApplicationController::appeal()). appealed_at doubles as the
            // one-shot-appeal guard — once set, appeal() refuses a second
            // request for the same rejection.
            $table->text('appeal_reason')->nullable()->after('rejection_reason');
            $table->string('appeal_document_path')->nullable()->after('appeal_reason');
            $table->timestamp('appealed_at')->nullable()->after('appeal_document_path');

            // Set by VerifierController::appealDecision().
            $table->text('appeal_decision_notes')->nullable()->after('appealed_at');
            $table->timestamp('appeal_decided_at')->nullable()->after('appeal_decision_notes');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn([
                'appeal_reason',
                'appeal_document_path',
                'appealed_at',
                'appeal_decision_notes',
                'appeal_decided_at',
            ]);
        });
    }
};
