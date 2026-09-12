<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Renames ClaimingSchedule's publish-flow columns to match what the
 * schedule actually does now: "is_published" implied a one-time bulk
 * assignment event. Now activating a schedule just makes it the live
 * target that VerifierController::approve() assigns newly-approved
 * applicants into, in real time, one at a time, as they're approved.
 * "is_active" / "activated_at" describe that accurately.
 *
 * Requires doctrine/dbal (already in composer.json) for renameColumn().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('claiming_schedules', function (Blueprint $table) {
            $table->renameColumn('is_published', 'is_active');
            $table->renameColumn('published_at', 'activated_at');
        });
    }

    public function down(): void
    {
        Schema::table('claiming_schedules', function (Blueprint $table) {
            $table->renameColumn('is_active', 'is_published');
            $table->renameColumn('activated_at', 'published_at');
        });
    }
};