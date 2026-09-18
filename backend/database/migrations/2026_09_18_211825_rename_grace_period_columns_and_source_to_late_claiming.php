<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Part of the Grace Period -> Late Claiming rename: renames the two
// claiming_schedules columns to match, and updates the stored
// claiming_assignments.source enum value used to mark a row as a
// late-claiming retry (previously 'grace_period_retry').
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('claiming_schedules', function (Blueprint $table) {
            $table->renameColumn('grace_period_date', 'late_claiming_date');
            $table->renameColumn('grace_period_end_date', 'late_claiming_end_date');
        });

        // `source` is a strict MySQL ENUM (see the migration that added
        // 'grace_period_retry') — renaming the stored values without also
        // widening the enum definition first would silently truncate every
        // 'late_claiming_retry' insert to an empty string.
        DB::statement("ALTER TABLE claiming_assignments MODIFY source ENUM('original', 'waitlist_promotion', 'grace_period_retry', 'late_claiming_retry') NOT NULL");

        DB::table('claiming_assignments')
            ->where('source', 'grace_period_retry')
            ->update(['source' => 'late_claiming_retry']);

        DB::statement("ALTER TABLE claiming_assignments MODIFY source ENUM('original', 'waitlist_promotion', 'late_claiming_retry') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE claiming_assignments MODIFY source ENUM('original', 'waitlist_promotion', 'grace_period_retry', 'late_claiming_retry') NOT NULL");

        DB::table('claiming_assignments')
            ->where('source', 'late_claiming_retry')
            ->update(['source' => 'grace_period_retry']);

        DB::statement("ALTER TABLE claiming_assignments MODIFY source ENUM('original', 'waitlist_promotion', 'grace_period_retry') NOT NULL");

        Schema::table('claiming_schedules', function (Blueprint $table) {
            $table->renameColumn('late_claiming_date', 'grace_period_date');
            $table->renameColumn('late_claiming_end_date', 'grace_period_end_date');
        });
    }
};
