<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('applicant','sk_verifier','sk_admin','superadmin','it_support') NOT NULL DEFAULT 'applicant'");
    }

    public function down(): void
    {
        // Lossy but safe: reassign any superadmin/it_support rows to
        // sk_admin before narrowing the enum, so the rollback itself
        // never fails on data the widened enum allowed in.
        DB::statement("UPDATE users SET role = 'sk_admin' WHERE role IN ('superadmin', 'it_support')");
        DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('applicant','sk_verifier','sk_admin') NOT NULL DEFAULT 'applicant'");
    }
};
