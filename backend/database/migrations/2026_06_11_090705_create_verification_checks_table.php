<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('verification_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->foreignId('document_id')->constrained('application_documents')->onDelete('cascade');
            $table->foreignId('ocr_result_id')->constrained('ocr_results')->onDelete('cascade');
            $table->string('check_name');       // e.g. name_match, barangay_check
            $table->boolean('passed');
            $table->string('extracted_value')->nullable();
            $table->string('expected_value')->nullable();
            $table->text('flag_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_checks');
    }
};