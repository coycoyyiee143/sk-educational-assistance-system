<?php

namespace App\Services;

use App\Models\TrustedDevice;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

class TwoFactorService
{
    protected Google2FA $engine;

    // How long "remember this device" skips the authenticator step for.
    // Password is still required every login either way — this only
    // shortcuts the second factor, so it's kept deliberately short.
    const TRUSTED_DEVICE_DAYS = 10;

    // Hardcoded rather than relying on config('app.name') — that config
    // key ALWAYS has a value (Laravel's own default is the literal
    // string "Laravel", from config/app.php's env('APP_NAME', 'Laravel')),
    // so a fallback default here would never actually trigger. If
    // APP_NAME isn't set in .env, every user's authenticator app would
    // show "Laravel (their email)" instead of your actual system name.
    const ISSUER = 'Mamatid SK-EAS';

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
            self::ISSUER,
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

    // Checks the raw device token the frontend sent back against this
    // user's remembered devices. Only ever called for a user who already
    // has 2FA enabled — a never-enrolled user has no trusted device to skip to.
    public function isDeviceTrusted(User $user, ?string $rawToken): bool
    {
        if (!$rawToken) {
            return false;
        }

        return TrustedDevice::where('user_id', $user->id)
            ->where('token_hash', hash('sha256', $rawToken))
            ->where('expires_at', '>', now())
            ->exists();
    }

    // Called right after a successful 2FA check, only when the user ticked
    // "remember this device". Returns the plaintext token — only the hash
    // is persisted, so this is the caller's one chance to hand it back.
    public function rememberDevice(User $user, Request $request): string
    {
        $rawToken = Str::random(64);

        TrustedDevice::create([
            'user_id'    => $user->id,
            'token_hash' => hash('sha256', $rawToken),
            'user_agent' => substr((string) $request->userAgent(), 0, 255),
            'ip_address' => $request->ip(),
            'expires_at' => now()->addDays(self::TRUSTED_DEVICE_DAYS),
        ]);

        return $rawToken;
    }
}