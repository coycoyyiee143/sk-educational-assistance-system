<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('face_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');

            // Files captured during registration
            $table->string('id_image_path');       // uploaded valid ID
            $table->string('live_photo_path');      // live cam capture at registration

            // Result of comparing id_image vs live_photo during registration.
            // We store the face embedding (numeric vector, NOT the raw image)
            // extracted from the live registration photo, so future claiming-day
            // checks don't need to re-read/re-process the ID image every time.
            $table->json('face_embedding')->nullable();
            $table->decimal('registration_match_score', 5, 2)->nullable();

            $table->enum('status', ['pending', 'verified', 'failed'])->default('pending');
            $table->timestamp('verified_at')->nullable();

            // Claiming-day verification result (most recent attempt)
            $table->string('claiming_photo_path')->nullable();
            $table->decimal('claiming_match_score', 5, 2)->nullable();
            $table->enum('claiming_status', ['not_attempted', 'matched', 'no_match'])
                ->default('not_attempted');
            $table->timestamp('claiming_verified_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('face_verifications');
    }
};