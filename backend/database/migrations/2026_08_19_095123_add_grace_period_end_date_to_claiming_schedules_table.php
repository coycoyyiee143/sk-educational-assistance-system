<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('claiming_schedules', function (Blueprint $table) {
            $table->date('grace_period_end_date')->nullable()->after('grace_period_date');
        });
    }

    public function down(): void
    {
        Schema::table('claiming_schedules', function (Blueprint $table) {
            $table->dropColumn('grace_period_end_date');
        });
    }
};