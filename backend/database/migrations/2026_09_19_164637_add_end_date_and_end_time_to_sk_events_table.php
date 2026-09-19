<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sk_events', function (Blueprint $table) {
            // Nullable: a blank end just means a single-day event, so
            // existing rows and the simple one-day creation flow both
            // keep working without needing a value here.
            $table->date('end_date')->nullable()->after('event_time');
            $table->time('end_time')->nullable()->after('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('sk_events', function (Blueprint $table) {
            $table->dropColumn(['end_date', 'end_time']);
        });
    }
};
