<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users');
            $table->foreignId('config_id')->constrained('application_configurations');
            $table->string('control_number')->unique()->nullable();
            $table->string('school_name');
            $table->string('school_address')->nullable();
            $table->string('course');
            $table->string('year_level');
            $table->string('student_id_number')->nullable();
            $table->enum('status', [
                'pending_prescreening',
                'for_review',
                'approved',
                'rejected',
                'reupload_requested'
            ])->default('pending_prescreening');
            $table->text('rejection_reason')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applications');
    }
};