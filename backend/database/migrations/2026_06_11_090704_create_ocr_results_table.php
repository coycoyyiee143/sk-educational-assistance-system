<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ocr_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_id')->constrained('application_documents')->onDelete('cascade');
            $table->json('extracted_fields');   // raw extracted key-value pairs
            $table->float('confidence_score')->nullable();
            $table->boolean('is_low_confidence')->default(false);
            $table->text('raw_text')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ocr_results');
    }
};