<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\StudentProfile;
use App\Models\FaceVerification;
use App\Notifications\ApplicationStatusNotification;
use App\Services\FaceMatchingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    protected FaceMatchingService $faceService;

    public function __construct(FaceMatchingService $faceService)
    {
        $this->faceService = $faceService;
    }

    /**
     * Registration is now ATOMIC with face verification: the account,
     * profile, and email-verification notice are only created/sent if the
     * uploaded ID photo matches the live cam capture. If the match fails,
     * NOTHING is saved — no orphaned "half-registered" account is left
     * behind, so the applicant can just retake the photo and resubmit
     * without ever hitting an "email already taken" wall.
     */
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
            'id_image'      => 'required|file|mimes:jpg,jpeg,png|max:5120',
            'live_photo'    => 'required|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $idImage = $request->file('id_image');
        $livePhoto = $request->file('live_photo');

        // Compare BEFORE creating any database records. getRealPath() reads
        // straight from PHP's temp upload location — no need to store the
        // files anywhere first just to run the comparison.
        $result = $this->faceService->compareImages(
            $idImage->getRealPath(),
            $livePhoto->getRealPath(),
            $idImage->getClientOriginalName(),
            $livePhoto->getClientOriginalName()
        );

        if (isset($result['error'])) {
            // "Face service unavailable/unreachable" = something's wrong on
            // our end (503). Anything else is the service rejecting the
            // image itself (bad ID shape, no face found) — that's the
            // applicant's to fix, so 422.
            $isServiceDown = str_contains($result['error'], 'unavailable') || str_contains($result['error'], 'unreachable');
            return response()->json(['message' => $result['error']], $isServiceDown ? 503 : 422);
        }

        if (!$result['match']) {
            return response()->json([
                'message' => 'The live photo does not match the uploaded ID. Please retake the photo with better lighting and try again.',
                'score'   => $result['score'],
            ], 422);
        }

        // Face matched — now it's safe to actually create the account.
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

        // Now persist the ID + live photo to permanent storage under this
        // user's folder, and record the verification result.
        $idImagePath = $idImage->storeAs(
            "face-verifications/{$user->id}",
            'id_' . time() . '.' . $idImage->getClientOriginalExtension(),
            'local'
        );
        $livePhotoPath = $livePhoto->storeAs(
            "face-verifications/{$user->id}",
            'live_' . time() . '.' . $livePhoto->getClientOriginalExtension(),
            'local'
        );

        FaceVerification::create([
            'user_id'                  => $user->id,
            'id_image_path'            => $idImagePath,
            'live_photo_path'          => $livePhotoPath,
            'face_embedding'           => $result['embedding'],
            'registration_match_score' => $result['score'],
            'status'                   => 'verified',
            'verified_at'              => now(),
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