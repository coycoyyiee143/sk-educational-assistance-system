<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // TOTP (authenticator app) support
            $table->text('google2fa_secret')->nullable()->after('password');
            $table->timestamp('google2fa_enabled_at')->nullable()->after('google2fa_secret');

            // Login lockout
            $table->unsignedTinyInteger('failed_login_attempts')->default(0)->after('google2fa_enabled_at');
            $table->timestamp('locked_until')->nullable()->after('failed_login_attempts');
        });

        Schema::create('password_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('password_hash');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'google2fa_secret',
                'google2fa_enabled_at',
                'failed_login_attempts',
                'locked_until',
            ]);
        });
        Schema::dropIfExists('password_histories');
    }
};