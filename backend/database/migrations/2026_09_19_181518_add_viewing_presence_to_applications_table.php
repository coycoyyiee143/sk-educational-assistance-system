<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            // Tracks only the MOST RECENT verifier to open this
            // application's review page, refreshed by a heartbeat while
            // that page stays open — enough to notice "someone else is
            // already here" without needing a full multi-viewer presence
            // list. viewing_heartbeat_at going stale (see
            // VerifierController::heartbeat()) is what "leaving" means;
            // there's no explicit release on navigate-away/close.
            $table->foreignId('viewing_verifier_id')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->timestamp('viewing_heartbeat_at')->nullable()->after('viewing_verifier_id');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropConstrainedForeignId('viewing_verifier_id');
            $table->dropColumn('viewing_heartbeat_at');
        });
    }
};
