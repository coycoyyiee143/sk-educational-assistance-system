<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('verification_checks', function (Blueprint $table) {
            // Carries structured extras from the Python side that don't
            // fit the existing columns — e.g. {"flag": "SUGGESTED_DISAPPROVAL",
            // "bbox": [...]} from residency_geofence when a contradicting
            // barangay is detected. Never drives automated routing on its
            // own (that stays a human decision) — purely a signal surfaced
            // to the verifier UI.
            $table->json('metadata')->nullable()->after('flag_reason');
        });
    }

    public function down(): void
    {
        Schema::table('verification_checks', function (Blueprint $table) {
            $table->dropColumn('metadata');
        });
    }
};