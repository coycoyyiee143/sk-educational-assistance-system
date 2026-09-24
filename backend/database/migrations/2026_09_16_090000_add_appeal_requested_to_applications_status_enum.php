<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Adds 'appeal_requested' — set when an applicant formally appeals a
        // 'rejected' application (see ApplicationController::appeal()). Same
        // enum-widening pattern as
        // 2026_09_13_050000_add_draft_incomplete_to_applications_status_enum.php.
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM(
            'draft_incomplete',
            'pending_prescreening',
            'for_review',
            'approved',
            'rejected',
            'reupload_requested',
            'auto_reupload_requested',
            'appeal_requested',
            'claimed',
            'not_cleared',
            'unclaimed',
            'waitlisted',
            'not_selected'
        ) DEFAULT 'draft_incomplete'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM(
            'draft_incomplete',
            'pending_prescreening',
            'for_review',
            'approved',
            'rejected',
            'reupload_requested',
            'auto_reupload_requested',
            'claimed',
            'not_cleared',
            'unclaimed',
            'waitlisted',
            'not_selected'
        ) DEFAULT 'draft_incomplete'");
    }
};
