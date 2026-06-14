<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('claiming_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->unique()->constrained('applications')->onDelete('cascade');
            $table->foreignId('claiming_schedule_id')->constrained('claiming_schedules')->onDelete('cascade');
            $table->foreignId('claiming_lane_id')->constrained('claiming_lanes')->onDelete('cascade');
            $table->enum('claim_status', ['pending', 'claimed', 'not_cleared', 'unclaimed'])->default('pending');
            $table->json('verified_documents')->nullable();
            $table->text('verifier_notes')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users');
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('reminder_sent_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('claiming_assignments');
    }
};