<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\StudentProfile;
use App\Notifications\ApplicationStatusNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
        public function register(Request $request)
    {
        $request->validate([
            'first_name'    => 'required|string|max:255',
            'middle_name'   => 'nullable|string|max:255',
            'last_name'     => 'required|string|max:255',
            'email'         => 'required|email|unique:users,email',
            'mobile_number' => 'nullable|string|unique:users,mobile_number',
            'password'      => 'required|string|min:8|confirmed',
            'birthdate'     => 'required|date|before:today',
            'barangay'      => 'required|string|max:255',
        ]);

        // Duplicate-applicant check (registration-time): block a new account
        // if the name + birthdate already matches someone who has an approved
        // or claimed application on file. This is the first of two checks —
        // the second runs again at application submission time, since a
        // determined duplicate could still theoretically slip past this one
        // (e.g. a slight name variation the string match doesn't catch).
        $normalizedFirstName = strtolower(trim($request->first_name));
        $normalizedLastName = strtolower(trim($request->last_name));

        $possibleDuplicates = User::whereHas('profile', function ($q) use ($request) {
                $q->where('birthdate', $request->birthdate);
            })
            ->get()
            ->filter(function ($otherUser) use ($normalizedFirstName, $normalizedLastName) {
                return strtolower(trim($otherUser->first_name)) === $normalizedFirstName
                    && strtolower(trim($otherUser->last_name)) === $normalizedLastName;
            });

                if ($possibleDuplicates->isNotEmpty()) {
            return response()->json([
                'message' => 'An account matching your name and date of birth already exists under a different account. Please contact the SK office if you believe this is an error.',
            ], 400);
        }

        $user = User::create([
            'first_name'    => $request->first_name,
            'middle_name'   => $request->middle_name,
            'last_name'     => $request->last_name,
            'email'         => $request->email,
            'mobile_number' => $request->mobile_number,
            'password'      => Hash::make($request->password),
            'role'          => 'applicant',
        ]);
        // Profile starts pre-filled with what Register already collected —
        // is_profile_complete stays false until the applicant fills in the
        // rest via the Profile page.
        StudentProfile::create([
            'user_id'   => $user->id,
            'birthdate' => $request->birthdate,
            'barangay'  => $request->barangay,
        ]);
        // TRIGGER: Automatically dispatches Laravel's email verification link via your Log/Mail system
        $user->sendEmailVerificationNotification();
        $token = $user->createToken('auth_token')->plainTextToken;
        
        return response()->json([
            'message' => 'Registration successful. Please check your email to verify your account.',
            'token'   => $token,
            'user'    => $user,
        ], 201);
    }
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {

            // Log the failed attempt (useful for spotting brute-force attempts)
            \App\Models\AuditLog::create([
                'user_id'     => $user->id ?? null,
                'action'      => 'login_failed',
                'description' => "Failed login attempt for: {$request->email}",
                'ip_address'  => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Account is deactivated.'], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

          // Log this login for the audit trail
        \App\Models\AuditLog::create([
            'user_id'     => $user->id,
            'action'      => 'login',
            'description' => "{$user->first_name} {$user->last_name} logged in",
            'ip_address'  => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Login successful.',
            'token'   => $token,
            'user'    => $user,
        ]);
    }

    public function logout(Request $request)
    {
         $user = $request->user();

        // Log this logout for the audit trail
        \App\Models\AuditLog::create([
            'user_id'     => $user->id,
            'action'      => 'logout',
            'description' => "{$user->first_name} {$user->last_name} logged out",
            'ip_address'  => $request->ip(),
        ]);

        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user()->load('profile'));
    }

    public function verifyEmail(Request $request, $id, $token)
    {
        $user = User::findOrFail($id);

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email already verified.']);
        }

        if (!$user->verification_token || !hash_equals((string) $user->verification_token, (string) $token)) {
            return response()->json(['message' => 'This verification link is invalid. Please request a new one.'], 400);
        }

        if (!$user->verification_token_expires_at || now()->greaterThan($user->verification_token_expires_at)) {
            return response()->json(['message' => 'This verification link has expired. Please request a new one.'], 400);
        }

        $user->forceFill([
            'email_verified_at'             => now(),
            'verification_code'             => null,
            'verification_code_expires_at'  => null,
            'verification_token'            => null,
            'verification_token_expires_at' => null,
        ])->save();

        return response()->json(['message' => 'Email verified successfully.']);
    }
    
public function resendVerification(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email already verified.']);
        }

        // TRIGGER: Manually resends verification notification on request
        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Verification email resent.']);
    }

    // Fallback verification path: lets the applicant type the 6-digit code
    // instead of clicking the link, for when the email is opened on a
    // different device than the one they're verifying on.
    public function verifyEmailByCode(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'code'  => 'required|string|size:6',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        if ($user->email_verified_at) {
            return response()->json(['message' => 'Email already verified.']);
        }

        if (!$user->verification_code || $user->verification_code !== $request->code) {
            return response()->json(['message' => 'Invalid verification code.'], 400);
        }

        if (!$user->verification_code_expires_at || now()->greaterThan($user->verification_code_expires_at)) {
            return response()->json(['message' => 'This code has expired. Please request a new one.'], 400);
        }

        $user->forceFill([
            'email_verified_at'             => now(),
            'verification_code'             => null,
            'verification_code_expires_at'  => null,
            'verification_token'            => null,
            'verification_token_expires_at' => null,
        ])->save();

        return response()->json(['message' => 'Email verified successfully.']);
    }
}