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
        Schema::table('users', function (Blueprint $table) {
            // Admin-granted exception to the SK 17-30 age bracket — lets an
            // applicant who has aged past 30 keep applying (e.g. birthdate
            // was encoded wrong, or a legitimate case-by-case exception),
            // without touching is_active (which governs login access, not
            // application eligibility).
            $table->boolean('age_exempt')->default(false)->after('is_active');
            $table->string('age_exempt_reason')->nullable()->after('age_exempt');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['age_exempt', 'age_exempt_reason']);
        });
    }
};
