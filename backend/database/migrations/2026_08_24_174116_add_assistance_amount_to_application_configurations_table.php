<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('application_configurations', function (Blueprint $table) {
            // Default 2000 so existing rows (created before this field existed)
            // backfill to the known historical amount instead of null.
            $table->unsignedInteger('assistance_amount')->default(2000)->after('slots_filled');
        });
    }

    public function down(): void
    {
        Schema::table('application_configurations', function (Blueprint $table) {
            $table->dropColumn('assistance_amount');
        });
    }
};