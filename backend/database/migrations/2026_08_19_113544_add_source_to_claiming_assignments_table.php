<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->enum('source', ['original', 'waitlist_promotion'])->default('original')->after('claim_status');
        });
    }

    public function down(): void
    {
        Schema::table('claiming_assignments', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};