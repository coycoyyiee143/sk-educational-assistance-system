<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('application_configurations', function (Blueprint $table) {
            $table->timestamp('closed_at')->nullable()->after('close_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('application_configurations', function (Blueprint $table) {
            $table->dropColumn('closed_at');
        });
    }
};
