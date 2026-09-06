<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE applications MODIFY status ENUM(
            'pending_prescreening','for_review','approved','rejected','reupload_requested',
            'claimed','not_cleared','unclaimed','waitlisted','not_selected'
        ) DEFAULT 'pending_prescreening'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE applications MODIFY status ENUM(
            'pending_prescreening','for_review','approved','rejected','reupload_requested',
            'claimed','not_cleared','unclaimed','waitlisted'
        ) DEFAULT 'pending_prescreening'");
    }
};
