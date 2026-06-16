<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('claiming_lanes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('claiming_schedule_id')->constrained('claiming_schedules')->onDelete('cascade');
            $table->string('lane_name');
            $table->string('control_number_from');
            $table->string('control_number_to');
            $table->enum('batch', ['morning', 'afternoon']);
            $table->date('claiming_date');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('claiming_lanes');
    }
};