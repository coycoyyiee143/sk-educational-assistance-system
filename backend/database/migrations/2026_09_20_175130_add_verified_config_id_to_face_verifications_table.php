<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('face_verifications', function (Blueprint $table) {
            // Tracks which application period the current face capture was
            // verified against, so the profile page knows whether a newer
            // period requires a fresh re-capture. Null means "never
            // re-verified since this column was added" (e.g. registration
            // predates the periodic re-verification feature).
            $table->foreignId('verified_config_id')
                ->nullable()
                ->after('verified_at')
                ->constrained('application_configurations')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('face_verifications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('verified_config_id');
        });
    }
};
