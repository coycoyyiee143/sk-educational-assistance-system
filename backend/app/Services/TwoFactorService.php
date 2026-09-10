<?php

namespace App\Services;

use App\Models\User;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorService
{
    protected Google2FA $engine;

    public function __construct()
    {
        $this->engine = new Google2FA();
    }

    // Called once, during account setup / first-time 2FA enrollment.
    public function generateSecret(): string
    {
        return $this->engine->generateSecretKey();
    }

    public function getQrCodeUrl(User $user, string $secret): string
    {
        return $this->engine->getQRCodeUrl(
            config('app.name', 'SK-EAS'),
            $user->email,
            $secret
        );
    }

    // Confirms the code entered during setup matches, then activates 2FA for the account.
    public function confirmSetup(User $user, string $secret, string $code): bool
    {
        if (!$this->engine->verifyKey($secret, $code)) {
            return false;
        }

        $user->forceFill([
            'google2fa_secret' => encrypt($secret),
            'google2fa_enabled_at' => now(),
        ])->save();

        return true;
    }

    // Used every login, once 2FA is already enabled.
    public function verify(User $user, string $code): bool
    {
        if (!$user->google2fa_secret) {
            return false;
        }

        $secret = decrypt($user->google2fa_secret);

        // Window of 1 tolerates minor clock drift (allows the previous/next 30s code too).
        return $this->engine->verifyKey($secret, $code, 1);
    }
}