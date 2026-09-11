<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\PasswordHistory;
use App\Rules\NotObviouslyWeakPassword;
use App\Rules\NotRecentlyUsedPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

/**
 * Handles the link-based flow for BOTH brand-new personnel accounts
 * (created by an admin with no password of their own) and
 * admin-initiated password resets for existing personnel. Both cases
 * end up here because both start the same way: the account's password
 * is set to an unguessable placeholder nobody knows, a one-time link
 * is emailed, and the account stays unusable until the person clicks
 * it and sets their own password. Neither the creating/resetting admin
 * ever sees or chooses the account's real password.
 */
class PersonnelSetupController extends Controller
{
    // Called by the frontend BEFORE showing the "set your password" form,
    // so an expired/invalid link can show a clear message instead of
    // letting someone fill out a form only to have it rejected.
    public function show(string $token)
    {
        $user = User::where('verification_token', $token)->first();

        if (!$user || !$user->verification_token_expires_at || now()->greaterThan($user->verification_token_expires_at)) {
            return response()->json(['message' => 'This link is invalid or has expired. Contact your SK admin for a new one.'], 400);
        }

        return response()->json([
            'first_name' => $user->first_name,
            'email'      => $user->email,
        ]);
    }

    public function store(Request $request, string $token)
    {
        $user = User::where('verification_token', $token)->first();

        if (!$user || !$user->verification_token_expires_at || now()->greaterThan($user->verification_token_expires_at)) {
            return response()->json(['message' => 'This link is invalid or has expired. Contact your SK admin for a new one.'], 400);
        }

        $request->validate([
            'password' => [
                'required',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*\d).+$/',
                Password::min(8)->uncompromised(),
                new NotObviouslyWeakPassword(),
                // Naturally a no-op for a brand-new account (empty
                // history) and correctly blocks reuse for a reset
                // account — no need to special-case either.
                new NotRecentlyUsedPassword($user->id, 5),
            ],
        ], [
            'password.regex' => 'Password must include at least one lowercase letter and one number.',
        ]);

        $newHash = Hash::make($request->password);

        $user->forceFill([
            'password'                       => $newHash,
            'email_verified_at'              => $user->email_verified_at ?? now(),
            'verification_token'             => null,
            'verification_token_expires_at'  => null,
            'failed_login_attempts'          => 0,
            'locked_until'                   => null,
        ])->save();

        PasswordHistory::create(['user_id' => $user->id, 'password_hash' => $newHash]);

        \App\Models\AuditLog::record(
            'personnel_account_activated',
            $user,
            "{$user->first_name} {$user->last_name} set their password and activated their account"
        );

        return response()->json(['message' => 'Password set. You can now log in.']);
    }
}