<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Adds 'draft_incomplete' — the status a newly-created application
        // should hold before all 3 required documents are uploaded (see
        // ApplicationController::store()). Same enum-widening pattern as
        // 2026_09_01_223253_add_auto_reupload_requested_to_applications_status_enum.php.
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

    public function down(): void
    {
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM(
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
        ) DEFAULT 'pending_prescreening'");
    }
};