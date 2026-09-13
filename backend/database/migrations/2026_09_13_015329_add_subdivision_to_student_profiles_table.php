<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            // Only filled in (and required, enforced client + server side)
            // when purok_type is "phase" — puroks run along streets and
            // have no subdivision, phases always belong to one.
            $table->string('subdivision')->nullable()->after('purok_type');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn('subdivision');
        });
    }
};