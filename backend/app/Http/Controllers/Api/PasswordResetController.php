<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetCodeMail;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\PasswordHistory;
use App\Rules\NotObviouslyWeakPassword;
use App\Rules\NotRecentlyUsedPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class PasswordResetController extends Controller
{
    /**
     * Send a 6-digit password reset code.
     */
    public function sendResetCode(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = strtolower(trim($request->email));

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        /*
         * SECURITY:
         * Do not reveal whether an email is registered.
         */
        if (!$user) {
            return response()->json([
                'message' => 'If an account exists with that email address, a password reset code has been sent.',
            ]);
        }

        $code = (string) random_int(100000, 999999);

        /*
         * Remove any previous reset code for this email.
         */
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->delete();

        /*
         * Store the HASHED reset code.
         */
        DB::table('password_reset_tokens')->insert([
            'email' => $user->email,
            'token' => Hash::make($code),
            'created_at' => now(),
        ]);

        /*
         * Send password reset email. Uses PasswordResetCodeMail, the
         * same Mailable + Blade view pattern as PersonnelAccountMail —
         * the markup lives in resources/views/emails/, not inline in
         * this controller.
         *
         * Wrapped in try/catch: the code is already stored above by this
         * point regardless of whether the email goes out, so a mail
         * failure here shouldn't 500 the request. The response message
         * stays the SAME generic "if an account exists..." text whether
         * sending succeeded or failed — this endpoint's whole point is
         * not leaking account existence, and a different message on
         * mail failure would leak exactly that (an attacker could tell
         * a real account from a fake one by watching which response
         * shape comes back). A genuinely broken mail server is an infra
         * problem to catch from the logs below, not something to expose
         * to the caller.
         */
        try {
            Mail::to($user->email)->send(new PasswordResetCodeMail($user->first_name, $code));
        } catch (\Throwable $e) {
            \Log::error("Password reset code email failed to send for {$user->email}: " . $e->getMessage());
        }

        return response()->json([
            'message' => 'If an account exists with that email address, a password reset code has been sent.',
        ]);
    }

    /**
     * Verify the 6-digit password reset code.
     */
    public function verifyResetCode(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
        ]);

        $email = strtolower(trim($request->email));

        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            return response()->json([
                'message' => 'Invalid or expired reset code.',
            ], 422);
        }

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'message' => 'Invalid or expired reset code.',
            ], 422);
        }

        /*
         * Reset code expires after 15 minutes.
         */
        if (
            !$resetRecord->created_at ||
            now()->diffInMinutes($resetRecord->created_at) > 15
        ) {
            DB::table('password_reset_tokens')
                ->where('email', $user->email)
                ->delete();

            return response()->json([
                'message' => 'Your reset code has expired. Please request a new one.',
            ], 422);
        }

        /*
         * Compare the entered code with the hashed code.
         */
        if (!Hash::check($request->code, $resetRecord->token)) {
            return response()->json([
                'message' => 'Invalid or expired reset code.',
            ], 422);
        }

        return response()->json([
            'message' => 'Reset code verified successfully.',
        ]);
    }

    /**
     * Reset the user's password.
     *
     * Now enforces the SAME policy as every other password-writing
     * path in the system (register, self-service change, admin-created
     * accounts, personnel setup): 8 char min, lowercase+number,
     * breach-checked, blocked against obvious weak terms, can't reuse
     * last 5. Previously this only checked `min:8|confirmed` — meaning
     * "forgot password" was a complete bypass of the entire policy,
     * and the new password was never even recorded into
     * PasswordHistory, leaving a gap for future reuse-checks too.
     */
    public function resetPassword(Request $request)
    {
        $email = strtolower(trim($request->email ?? ''));
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        $request->validate([
            'email' => ['required', 'email'],
            'code'  => ['required', 'digits:6'],
            'password' => [
                'required',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*\d).+$/',
                Password::min(8)->uncompromised(),
                new NotObviouslyWeakPassword(),
                // Only meaningful if we actually found a user above —
                // pass a harmless 0 otherwise so this rule doesn't
                // itself throw on a not-found account (the "don't
                // reveal whether an email exists" pattern used
                // elsewhere in this controller still applies below).
                new NotRecentlyUsedPassword($user->id ?? 0, 5),
            ],
        ], [
            'password.regex' => 'Password must include at least one lowercase letter and one number.',
        ]);

        if (!$user) {
            return response()->json([
                'message' => 'Invalid or expired reset request.',
            ], 422);
        }

        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'message' => 'Invalid or expired reset request.',
            ], 422);
        }

        /*
         * Check expiry again.
         *
         * This is required even if verifyResetCode() was already
         * called because the reset endpoint can be called directly.
         */
        if (
            !$resetRecord->created_at ||
            now()->diffInMinutes($resetRecord->created_at) > 15
        ) {
            DB::table('password_reset_tokens')
                ->where('email', $user->email)
                ->delete();

            return response()->json([
                'message' => 'Your reset code has expired. Please request a new one.',
            ], 422);
        }

        /*
         * Verify the reset code again.
         */
        if (!Hash::check($request->code, $resetRecord->token)) {
            return response()->json([
                'message' => 'Invalid or expired reset request.',
            ], 422);
        }

        /*
         * Save the new password.
         */
        $newHash = Hash::make($request->password);
        $user->forceFill([
            'password'              => $newHash,
            'remember_token'        => Str::random(60),
            'failed_login_attempts' => 0,
            'locked_until'          => null,
        ])->save();

        PasswordHistory::create(['user_id' => $user->id, 'password_hash' => $newHash]);

        // Keep only the last 5 history rows per user.
        $keepIds = PasswordHistory::where('user_id', $user->id)->latest()->take(5)->pluck('id');
        PasswordHistory::where('user_id', $user->id)->whereNotIn('id', $keepIds)->delete();

        /*
         * IMPORTANT:
         * Forgot Password is a PUBLIC endpoint, so there is no
         * authenticated Auth::id().
         *
         * Explicitly pass $user as the actor so this reset appears
         * in that user's audit trail.
         */
        AuditLog::create([
            'user_id'        => $user->id,
            'action'         => 'password_reset',
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'description'    => 'You reset your password using Forgot Password',
            'ip_address'     => $request->ip(),
        ]);

        /*
         * Delete the reset code after successful use.
         */
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->delete();

        /*
         * Revoke existing Sanctum tokens/sessions.
         */
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Your password has been reset successfully.',
        ]);
    }
}