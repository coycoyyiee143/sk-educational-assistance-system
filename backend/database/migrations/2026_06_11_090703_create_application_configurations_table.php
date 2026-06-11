<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_configurations', function (Blueprint $table) {
            $table->id();
            $table->string('school_year');
            $table->string('semester');
            $table->date('open_date');
            $table->date('close_date');
            $table->integer('total_slots');
            $table->integer('used_slots')->default(0);
            $table->boolean('is_active')->default(false);
            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_configurations');
    }
};