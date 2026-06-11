<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('application_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->enum('document_type', [
                'voters_certificate',
                'registration_form',
                'school_id'
            ]);
            $table->string('file_path');
            $table->string('file_name');
            $table->string('mime_type')->nullable();
            $table->integer('version')->default(1);
            $table->enum('status', [
                'pending',
                'processing',
                'processed',
                'failed'
            ])->default('pending');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_documents');
    }
};