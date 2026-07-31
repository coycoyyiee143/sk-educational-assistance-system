<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->date('birthdate')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->nullable();
            $table->enum('civil_status', ['single', 'married', 'widowed', 'separated'])->nullable();
            $table->string('house_no')->nullable();
            $table->string('street')->nullable();
            $table->string('purok')->nullable();
            $table->string('barangay')->nullable();
            $table->string('city')->nullable();
            $table->string('province')->nullable();
            $table->string('guardian_first_name')->nullable();
            $table->string('guardian_middle_name')->nullable();
            $table->string('guardian_last_name')->nullable();
            $table->string('guardian_relationship')->nullable();
            $table->string('guardian_contact')->nullable();
            $table->boolean('is_profile_complete')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('student_profiles');
    }
};