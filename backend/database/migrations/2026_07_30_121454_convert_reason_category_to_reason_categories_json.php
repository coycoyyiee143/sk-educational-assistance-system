<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('verifier_actions', function (Blueprint $table) {
            $table->dropColumn('reason_category');
        });
        Schema::table('verifier_actions', function (Blueprint $table) {
            $table->json('reason_categories')->nullable()->after('action');
        });

        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->dropColumn('reason_category');
        });
        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->json('reason_categories')->nullable()->after('claim_status');
        });
    }

    public function down(): void
    {
        Schema::table('verifier_actions', function (Blueprint $table) {
            $table->dropColumn('reason_categories');
        });
        Schema::table('verifier_actions', function (Blueprint $table) {
            $table->string('reason_category')->nullable()->after('action');
        });

        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->dropColumn('reason_categories');
        });
        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->string('reason_category')->nullable()->after('claim_status');
        });
    }
};