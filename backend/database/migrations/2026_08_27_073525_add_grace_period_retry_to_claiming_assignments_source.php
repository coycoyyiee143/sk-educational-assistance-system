<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Widen the enum first — safe even if 'grace_period_retry' already
        // exists as a plain string column type, this statement would just
        // fail harmlessly in that case (worth checking your actual schema
        // if this errors — it may mean `source` isn't an enum at all).
        DB::statement("ALTER TABLE claiming_assignments MODIFY source ENUM('original', 'waitlist_promotion', 'grace_period_retry') NOT NULL");
    }

    public function down(): void
    {
        DB::table('claiming_assignments')
            ->where('source', 'grace_period_retry')
            ->update(['source' => 'original']);

        DB::statement("ALTER TABLE claiming_assignments MODIFY source ENUM('original', 'waitlist_promotion') NOT NULL");
    }
};