<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL enums can't be altered with Schema::table() the normal
        // way — needs a raw MODIFY COLUMN statement listing every
        // existing allowed value PLUS the new one. Same class of bug
        // already hit once before on claiming_assignments.claim_status
        // when 'pending_claiming' was added without updating that enum.
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

    public function down(): void
    {
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM(
            'pending_prescreening',
            'for_review',
            'approved',
            'rejected',
            'reupload_requested',
            'claimed',
            'not_cleared',
            'unclaimed',
            'waitlisted',
            'not_selected'
        ) DEFAULT 'pending_prescreening'");
    }
};