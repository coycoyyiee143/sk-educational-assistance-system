<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sk_events', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('event_date');
            $table->time('event_time')->nullable();
            $table->string('venue')->nullable();
            $table->string('image_path')->nullable();
            $table->boolean('is_published')->default(false);
            $table->foreignId('posted_by')->constrained('users');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sk_events');
    }
};