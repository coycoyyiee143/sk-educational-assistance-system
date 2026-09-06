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
        // Step 1: widen the enum to accept BOTH the old and new values
        // temporarily. Doing this first means no row is ever briefly
        // invalid while we update data below.
        DB::statement("ALTER TABLE claiming_assignments MODIFY claim_status ENUM('pending', 'pending_claiming', 'claimed', 'not_cleared', 'unclaimed') NOT NULL DEFAULT 'pending_claiming'");

        // Step 2: convert every existing row currently sitting at the old
        // 'pending' value over to 'pending_claiming', so no data is lost.
        DB::table('claiming_assignments')
            ->where('claim_status', 'pending')
            ->update(['claim_status' => 'pending_claiming']);

        // Step 3: now that nothing references 'pending' anymore, narrow
        // the enum back down to drop the old value entirely.
        DB::statement("ALTER TABLE claiming_assignments MODIFY claim_status ENUM('pending_claiming', 'claimed', 'not_cleared', 'unclaimed') NOT NULL DEFAULT 'pending_claiming'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Same three-step pattern, in reverse — widen, convert data back,
        // narrow back to the original enum.
        DB::statement("ALTER TABLE claiming_assignments MODIFY claim_status ENUM('pending', 'pending_claiming', 'claimed', 'not_cleared', 'unclaimed') NOT NULL DEFAULT 'pending'");

        DB::table('claiming_assignments')
            ->where('claim_status', 'pending_claiming')
            ->update(['claim_status' => 'pending']);

        DB::statement("ALTER TABLE claiming_assignments MODIFY claim_status ENUM('pending', 'claimed', 'not_cleared', 'unclaimed') NOT NULL DEFAULT 'pending'");
    }
};