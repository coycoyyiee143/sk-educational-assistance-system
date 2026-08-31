<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('claiming_assignments', function (Blueprint $table) {
            // Nullable — old rows (claimed before this column existed) won't
            // have a value. disbursementReport() falls back to the config's
            // current assistance_amount for those, but any NEW claim writes
            // a real snapshot here, so future amount changes never
            // retroactively alter what a historical disbursement shows.
            $table->unsignedInteger('amount')->nullable()->after('claim_status');
        });
    }

    public function down(): void
    {
        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->dropColumn('amount');
        });
    }
};