<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('verifier_actions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->foreignId('verifier_id')->constrained('users');
            $table->string('action'); // approved, rejected, reupload_requested
            $table->text('notes')->nullable();
            $table->json('reupload_details')->nullable(); 
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop the entire table if this migration is rolled back
        Schema::dropIfExists('verifier_actions');
    }
};