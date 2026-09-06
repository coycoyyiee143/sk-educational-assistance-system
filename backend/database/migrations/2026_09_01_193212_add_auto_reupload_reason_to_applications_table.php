<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            // Reason text for a SYSTEM-generated auto_reupload_requested
            // status — no VerifierAction exists for this case (no human
            // involved), so this can't come from reupload_details like the
            // human-initiated reupload_requested flow does.
            $table->text('auto_reupload_reason')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('auto_reupload_reason');
        });
    }
};