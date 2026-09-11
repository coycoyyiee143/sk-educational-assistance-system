<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\StudentProfile;
use App\Models\FaceVerification;
use App\Models\PasswordHistory;
use App\Notifications\ApplicationStatusNotification;
use App\Services\FaceMatchingService;
use App\Services\TwoFactorService;
use App\Rules\NotObviouslyWeakPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    protected FaceMatchingService $faceService;
    protected TwoFactorService $twoFactor;

    const MAX_FAILED_ATTEMPTS = 3;
    const LOCKOUT_MINUTES = 15;
    const PENDING_TOKEN_MINUTES = 10;

    // Shared password rule set: 8 char min, lowercase + number, breach-checked,
    // blocked against obvious/context-specific weak terms.
    // Used by register(), checkDuplicate() (pre-check, same rules so a
    // failure can't surface for the first time only after face capture),
    // and (reuse-block added) by ProfileController::updatePassword().
    public static function passwordRules(): array
    {
        return [
            'required',
            'confirmed',
            'regex:/^(?=.*[a-z])(?=.*\d).+$/',
            Password::min(8)->uncompromised(),
            new NotObviouslyWeakPassword(),
        ];
    }

    public function __construct(FaceMatchingService $faceService, TwoFactorService $twoFactor)
    {
        $this->faceService = $faceService;
        $this->twoFactor = $twoFactor;
    }

    /**
     * Shared name+birthdate duplicate lookup, used by both the
     * pre-face-verification check (checkDuplicate) and the final
     * register() save. Kept in one place so the two never drift out
     * of sync with each other.
     */
    private function findDuplicateApplicant(string $firstName, string $lastName, string $birthdate)
    {
        $normalizedFirstName = strtolower(trim($firstName));
        $normalizedLastName = strtolower(trim($lastName));

        return User::whereHas('profile', function ($q) use ($birthdate) {
                $q->where('birthdate', $birthdate);
            })
            ->get()
            ->filter(function ($otherUser) use ($normalizedFirstName, $normalizedLastName) {
                return strtolower(trim($otherUser->first_name)) === $normalizedFirstName
                    && strtolower(trim($otherUser->last_name)) === $normalizedLastName;
            });
    }

    /**
     * Pre-check called from the Register form BEFORE the applicant moves
     * on to face verification. Validates EVERYTHING that register() will
     * eventually check — email/mobile uniqueness, name+birthdate
     * duplicate, AND the full password policy — so a doomed registration
     * fails fast on the account-details form, before the applicant
     * wastes time on face capture only to be bounced back afterward with
     * an error that has nothing to do with their face.
     *
     * This does NOT reserve the email/mobile/name+birthdate combo — it's
     * still just a pre-check. register() re-validates everything again
     * at save time, since another registration could complete in
     * between the two calls.
     */
    public function checkDuplicate(Request $request)
    {
        $request->validate([
            'first_name'    => 'required|string|max:255',
            'middle_name'   => 'nullable|string|max:255',
            'last_name'     => 'required|string|max:255',
            'birthdate'     => 'required|date|before:today',
            'email'         => 'required|email',
            'mobile_number' => 'nullable|string|unique:users,mobile_number',
            'password'      => self::passwordRules(),
        ]);

        if (User::where('email', $request->email)->exists()) {
            return response()->json([
                'errors' => [
                    'email' => ['This email is already taken.'],
                ],
            ], 422);
        }

        $duplicates = $this->findDuplicateApplicant(
            $request->first_name,
            $request->last_name,
            $request->birthdate
        );

        if ($duplicates->isNotEmpty()) {
            return response()->json([
                'message' => 'An account matching your name and date of birth already exists under a different account. Please contact the SK office if you believe this is an error.',
            ], 400);
        }

        return response()->json(['message' => 'OK']);
    }

    /**
     * Registration is now ATOMIC with face verification: the account,
     * profile, and email-verification notice are only created/sent if the
     * uploaded ID photo matches the live cam capture. If the match fails,
     * NOTHING is saved — no orphaned "half-registered" account is left
     * behind, so the applicant can just retake the photo and resubmit
     * without ever hitting an "email already taken" wall.
     *
     * Also runs a name+birthdate duplicate check BEFORE face verification,
     * since it's the cheaper check and should short-circuit first if it's
     * going to fail anyway — no reason to call the face service for a
     * registration that's getting blocked regardless. (The Register form
     * also calls checkDuplicate() above earlier in the flow, before the
     * applicant even reaches face capture, now including mobile +
     * password validation too — this check here is the authoritative
     * re-check at save time, in case something changed between the two
     * calls.)
     *
     * A second duplicate check runs AFTER face verification: this one
     * compares the new live-photo embedding against every other verified
     * user's stored embedding, to block the SAME FACE registering under a
     * DIFFERENT name/account (the name+birthdate check above can't catch
     * that, since the identity fields would legitimately differ).
     */
    public function register(Request $request)
    {
        $request->validate([
            'first_name'    => 'required|string|max:255',
            'middle_name'   => 'nullable|string|max:255',
            'last_name'     => 'required|string|max:255',
            'email'         => 'required|email|unique:users,email',
            'mobile_number' => 'nullable|string|unique:users,mobile_number',
            'password'      => self::passwordRules(),
            'birthdate'     => 'required|date|before:today',
            'barangay'      => 'required|string|max:255',
            'id_image'      => 'required|file|mimes:jpg,jpeg,png,webp,heic,heif|max:5120',
            'live_photo'    => 'required|file|mimes:jpg,jpeg,png,webp,heic,heif|max:5120',
            'privacy_consent' => 'required|accepted',
        ]);

        // Duplicate-applicant check (registration-time): block a new account
        // if the name + birthdate already matches an existing account. This
        // is the first of two checks — the second runs again at application
        // submission time, since a determined duplicate could still
        // theoretically slip past this one (e.g. a slight name variation
        // the string match doesn't catch).
        $possibleDuplicates = $this->findDuplicateApplicant(
            $request->first_name,
            $request->last_name,
            $request->birthdate
        );
        if ($possibleDuplicates->isNotEmpty()) {
            return response()->json([
                'message' => 'An account matching your name and date of birth already exists under a different account. Please contact the SK office if you believe this is an error.',
            ], 400);
        }

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

        // Cross-user face duplicate check: same face already registered
        // under a DIFFERENT account. Same tolerance as face-service's
        // DEFAULT_TOLERANCE (0.5) for consistency with normal match logic.
        $duplicateTolerance = 0.5;
        $existingEmbeddings = FaceVerification::where('status', 'verified')
            ->whereNotNull('face_embedding')
            ->pluck('face_embedding');

        foreach ($existingEmbeddings as $existingEmbedding) {
            $distance = $this->faceService->embeddingDistance($result['embedding'], $existingEmbedding);
            if ($distance <= $duplicateTolerance) {
                \App\Models\AuditLog::create([
                    'user_id'     => null,
                    'action'      => 'face_duplicate_blocked',
                    'description' => "Registration blocked for {$request->first_name} {$request->last_name}: face matched an existing verified account (distance {$distance}).",
                    'ip_address'  => $request->ip(),
                ]);

                return response()->json([
                    'message' => 'This face is already registered under another account. Please log in instead, or contact SK if you believe this is an error.',
                ], 409);
            }
        }

        // Both duplicate checks passed, face matched — now it's safe to
        // actually create the account.
        $user = User::create([
            'first_name'         => $request->first_name,
            'middle_name'        => $request->middle_name,
            'last_name'          => $request->last_name,
            'email'              => $request->email,
            'mobile_number'      => $request->mobile_number,
            'password'           => Hash::make($request->password),
            'role'               => 'applicant',
            'privacy_consent_at' => now(),
        ]);

        // Seed password history with the initial password, so the very
        // first change already has something to check reuse against.
        PasswordHistory::create([
            'user_id'       => $user->id,
            'password_hash' => $user->password,
        ]);

        // Audit trail ng Data Privacy consent — proof kung sino, kailan, at saang IP nag-agree
        \App\Models\AuditLog::record(
            'consent',
            $user,
            "{$user->first_name} {$user->last_name} agreed to the Data Privacy Notice.",
            $user
        );

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

        // NOTE: no Sanctum token issued here anymore. Previously registration
        // logged the applicant straight in; now they still need to verify
        // their email AND enroll in 2FA before they get a token, both of
        // which happen through the normal /login flow on their first sign-in.

        return response()->json([
            'message' => 'Registration successful. Please check your email to verify your account, then log in.',
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

        // Lockout check — happens before the password check so a locked
        // account doesn't leak "your password was right" via timing/response
        // differences, and so we don't waste a Hash::check on it either.
        if ($user && $user->locked_until && now()->lessThan($user->locked_until)) {
            $minutesLeft = now()->diffInMinutes($user->locked_until) + 1;
            return response()->json([
                'message' => "Too many failed attempts. Try again in {$minutesLeft} minute(s).",
            ], 429);
        }

        if (!$user || !Hash::check($request->password, $user->password)) {
            if ($user) {
                $this->registerFailedAttempt($user);
            }

            // Log the failed attempt (useful for spotting brute-force attempts)
            \App\Models\AuditLog::create([
                'user_id'     => $user->id ?? null,
                'action'      => 'login_failed',
                'description' => "An unsuccessful login attempt was made on your account.",
                'ip_address'  => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json(['message' => 'Account is deactivated.'], 403);
        }
        // Block login until the applicant has verified their email/OTP —
        // without this, an account created but never confirmed could still
        // log in and use the system.
        if (!$user->email_verified_at) {
            return response()->json([
                'message'    => 'Please verify your email before logging in. Check your inbox for the verification code, or request a new one.',
                'unverified' => true,
                'email'      => $user->email,
            ], 403);
        }

        // Correct password, account in good standing — reset the failed-attempt counter.
        $user->forceFill(['failed_login_attempts' => 0, 'locked_until' => null])->save();

        // 2FA gate. No Sanctum token is issued yet either way — only a
        // short-lived pending token the frontend must exchange (along with
        // the 6-digit code) at /2fa/setup/confirm or /2fa/verify.
        $pendingToken = Str::random(40);

        if (!$user->google2fa_enabled_at) {
            // First login ever, or 2FA was never finished being set up —
            // force enrollment before they can do anything else.
            $secret = $this->twoFactor->generateSecret();

            Cache::put("2fa_setup:{$pendingToken}", [
                'user_id' => $user->id,
                'secret'  => $secret,
            ], now()->addMinutes(self::PENDING_TOKEN_MINUTES));

            return response()->json([
                'requires_2fa_setup' => true,
                'pending_token'      => $pendingToken,
                'qr_code_url'        => $this->twoFactor->getQrCodeUrl($user, $secret),
                'secret'             => $secret, // manual-entry fallback if they can't scan
                'email'              => $user->email, // shown in the UI so it's clear WHICH account this QR belongs to
            ]);
        }

        Cache::put("2fa_pending:{$pendingToken}", $user->id, now()->addMinutes(self::PENDING_TOKEN_MINUTES));

        return response()->json([
            'requires_2fa'  => true,
            'pending_token' => $pendingToken,
        ]);
    }

    protected function registerFailedAttempt(User $user): void
    {
        $attempts = $user->failed_login_attempts + 1;

        $data = ['failed_login_attempts' => $attempts];
        if ($attempts >= self::MAX_FAILED_ATTEMPTS) {
            $data['locked_until'] = now()->addMinutes(self::LOCKOUT_MINUTES);
            $data['failed_login_attempts'] = 0;
        }

        $user->forceFill($data)->save();
    }

    // Step 2a: first-time 2FA enrollment. Confirms the code from the
    // authenticator app actually matches the secret issued at login,
    // activates 2FA, and only THEN issues the real Sanctum token.
    public function confirmTwoFactorSetup(Request $request)
    {
        $request->validate([
            'pending_token' => 'required|string',
            'code'          => 'required|digits:6',
        ]);

        $payload = Cache::get("2fa_setup:{$request->pending_token}");
        if (!$payload) {
            return response()->json(['message' => 'Setup session expired. Please log in again.'], 400);
        }

        $user = User::findOrFail($payload['user_id']);

        if (!$this->twoFactor->confirmSetup($user, $payload['secret'], $request->code)) {
            return response()->json(['message' => 'Invalid code. Check your authenticator app and try again.'], 422);
        }

        Cache::forget("2fa_setup:{$request->pending_token}");

        return $this->issueTokenAfterTwoFactor($user, $request);
    }

    // Step 2b: normal login 2FA check, once already enrolled.
    public function verifyTwoFactor(Request $request)
    {
        $request->validate([
            'pending_token' => 'required|string',
            'code'          => 'required|digits:6',
        ]);

        $userId = Cache::get("2fa_pending:{$request->pending_token}");
        if (!$userId) {
            return response()->json(['message' => 'Login session expired. Please log in again.'], 400);
        }

        $user = User::findOrFail($userId);

        if (!$this->twoFactor->verify($user, $request->code)) {
            return response()->json(['message' => 'Invalid code.'], 422);
        }

        Cache::forget("2fa_pending:{$request->pending_token}");

        return $this->issueTokenAfterTwoFactor($user, $request);
    }

    private function issueTokenAfterTwoFactor(User $user, Request $request)
    {
        $token = $user->createToken('auth_token')->plainTextToken;

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