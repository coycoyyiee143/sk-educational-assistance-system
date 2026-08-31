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
            $table->foreignId('verifier_id')->nullable()->after('lane_name')->constrained('users');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('claiming_lanes', function (Blueprint $table) {
            $table->dropForeign(['verifier_id']);
            $table->dropColumn('verifier_id');
        });
    }
};
