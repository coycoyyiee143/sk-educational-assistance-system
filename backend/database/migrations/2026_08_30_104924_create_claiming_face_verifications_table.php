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
        // One row per verification ATTEMPT, tied to the specific claiming
        // assignment it happened for — not one row per user like
        // face_verifications. This is what makes multiple grace-period
        // retries (sweep-driven) each keep their own proof instead of the
        // latest attempt silently overwriting the last.
        Schema::create('claiming_face_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('claiming_assignment_id')->constrained('claiming_assignments')->onDelete('cascade');
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->string('claiming_photo_path');
            $table->float('match_score')->nullable();
            $table->boolean('matched');
            $table->timestamp('verified_at');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('claiming_face_verifications');
    }
};