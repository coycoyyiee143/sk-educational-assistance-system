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
        Schema::table('claiming_lanes', function (Blueprint $table) {
            // A verifier requesting to take over this lane no longer
            // reassigns it directly (that let one verifier silently bump
            // another off their lane) — it's recorded here and only takes
            // effect once an admin approves it via AdminScheduleController.
            $table->foreignId('requested_verifier_id')->nullable()->after('verifier_id')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('claiming_lanes', function (Blueprint $table) {
            $table->dropForeign(['requested_verifier_id']);
            $table->dropColumn('requested_verifier_id');
        });
    }
};
