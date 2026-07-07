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
            $table->dateTime('open_date');
            $table->dateTime('close_date');
            $table->integer('slot_limit')->nullable();
            $table->integer('slots_filled')->default(0);
            $table->boolean('is_unlimited')->default(false);
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