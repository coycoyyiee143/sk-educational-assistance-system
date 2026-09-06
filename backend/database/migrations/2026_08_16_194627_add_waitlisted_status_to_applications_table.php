<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('waitlisted_at')->nullable()->after('control_number');
        });

        DB::statement("
            ALTER TABLE applications
            MODIFY COLUMN status ENUM(
                'pending_prescreening',
                'for_review',
                'approved',
                'rejected',
                'reupload_requested',
                'claimed',
                'not_cleared',
                'unclaimed',
                'waitlisted'
            ) DEFAULT 'pending_prescreening'
        ");
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('waitlisted_at');
        });

        DB::statement("
            ALTER TABLE applications
            MODIFY COLUMN status ENUM(
                'pending_prescreening',
                'for_review',
                'approved',
                'rejected',
                'reupload_requested',
                'claimed',
                'not_cleared',
                'unclaimed'
            ) DEFAULT 'pending_prescreening'
        ");
    }
};