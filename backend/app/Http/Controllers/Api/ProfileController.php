<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApplicationConfiguration;
use App\Models\FaceVerification;
use App\Models\PasswordHistory;
use App\Rules\NotRecentlyUsedPassword;
use App\Rules\NotObviouslyWeakPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        return response()->json($request->user()->load('profile'));
    }

    public function store(Request $request)
    {

        
        $user = $request->user();

        if ($user->profile && $user->profile->is_profile_complete) {
            return response()->json(['message' => 'Profile already set up.'], 400);
        }

        $data = $this->validateProfile($request);
        $data['is_profile_complete'] = true;

        $profile = $user->profile()->updateOrCreate(
            ['user_id' => $user->id],
            $data
        );

        // Log the initial profile setup
        \App\Models\AuditLog::record(
            'profile_completed',
            $profile,
            'Completed initial profile setup'
        );


        return response()->json([
            'message' => 'Profile saved.',
            'profile' => $profile,
        ], 201);
    }

        public function update(Request $request)
    {
        if ($this->needsFaceReverify($request->user())) {
            return response()->json([
                'message' => 'Please re-verify your face for the current application period before saving profile changes.',
            ], 403);
        }

        $data = $this->validateProfile($request);
        $profile = $request->user()->profile;

        // Recompute completeness on every update — a profile becomes
        // "complete" once these core fields are filled in, regardless of
        // whether it was set via store() (first-time setup) or here (later edits).
        //
        // civil_status is deliberately NOT part of this check — it's
        // validated as nullable below and the frontend never marks it
        // required either. It used to be included here, which silently
        // forced it to be mandatory in practice (profile could never be
        // "complete" without it) even though nothing else in the system
        // treats it as required.
        //
        // "street" removed as a completeness requirement — the frontend
        // no longer collects it (superseded by Subdivision/Village, which
        // is collected instead, but only required when purok_type is
        // "phase"; puroks run along streets and have no subdivision).
        $data['is_profile_complete'] = (bool) (
            ($data['birthdate'] ?? null) &&
            ($data['gender'] ?? null) &&
            ($data['house_no'] ?? null) &&
            ($data['purok_type'] ?? null) &&
            ($data['purok'] ?? null) &&
            (($data['purok_type'] ?? null) !== 'phase' || ($data['subdivision'] ?? null)) &&
            ($data['barangay'] ?? null) &&
            ($data['city'] ?? null) &&
            ($data['province'] ?? null)
        );

        $profile->update($data);
        // Log which specific fields were changed, so the trail is meaningful
        $changes = $profile->getChanges();
        unset($changes['updated_at']);
        if (!empty($changes)) {
            $fieldList = implode(', ', array_keys($changes));
            \App\Models\AuditLog::record(
                'profile_updated',
                $profile,
                "Updated profile information ({$fieldList})"
            );
        }
        return response()->json([
            'message' => 'Profile updated.',
            'profile' => $request->user()->profile,
        ]);
    }

    public function updateAccount(Request $request)
    {
        $user = $request->user();

        if ($this->needsFaceReverify($user)) {
            return response()->json([
                'message' => 'Please re-verify your face for the current application period before saving profile changes.',
            ], 403);
        }

        $data = $request->validate([
            'first_name'    => 'required|string',
            'last_name'     => 'required|string',
            'middle_name'   => 'sometimes|nullable|string',
            'mobile_number' => 'required|string|unique:users,mobile_number,' . $user->id,
        ]);

        $user->update($data);

        $changes = $user->getChanges();
        unset($changes['updated_at']);

        if (!empty($changes)) {
            $fieldList = implode(', ', array_keys($changes));
            \App\Models\AuditLog::record(
                'account_updated',
                $user,
                "Updated account information ({$fieldList})"
            );
        }

        return response()->json(['message' => 'Account updated.', 'user' => $user]);
    }

    /**
     * Any authenticated role can set their own avatar (topbar photo) —
     * used first for verifiers, since they don't go through the
     * applicant's registration face-verification flow and so have no
     * other photo on file. Old file is removed so re-uploading doesn't
     * pile up orphaned files on the private disk.
     */
    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'avatar' => 'required|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $user = $request->user();

        if ($user->avatar_path && Storage::disk('local')->exists($user->avatar_path)) {
            Storage::disk('local')->delete($user->avatar_path);
        }

        $file = $request->file('avatar');
        $path = $file->storeAs(
            "avatars/{$user->id}",
            'avatar_' . time() . '.' . $file->getClientOriginalExtension(),
            'local'
        );

        $user->update(['avatar_path' => $path]);

        \App\Models\AuditLog::record(
            'account_updated',
            $user,
            'Updated profile photo'
        );

        return response()->json(['message' => 'Profile photo updated.', 'user' => $user->fresh()]);
    }

    /**
     * Streams the avatar for the given user — owner, any sk_verifier, or
     * any sk_admin can view it, same access rule as the applicant
     * profile-photo route (FaceVerificationController::profilePhoto).
     */
    public function avatarPhoto(Request $request, $userId)
    {
        $viewer = $request->user();
        $isOwner    = (int) $viewer->id === (int) $userId;
        $isVerifier = $viewer->role === 'sk_verifier';
        $isAdmin    = $viewer->role === 'sk_admin';

        if (!$isOwner && !$isVerifier && !$isAdmin) {
            abort(403, 'You are not authorized to view this photo.');
        }

        $user = \App\Models\User::findOrFail($userId);

        if (!$user->avatar_path || !Storage::disk('local')->exists($user->avatar_path)) {
            abort(404, 'No profile photo on file.');
        }

        return Storage::disk('local')->response(
            $user->avatar_path,
            basename($user->avatar_path)
        );
    }

    // Password policy: 8 char min, lowercase + number, breach-checked,
    // can't reuse any of the last 5 passwords. No expiry.
    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password' => [
                'required',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*\d).+$/',
                Password::min(8)->uncompromised(),
                new NotObviouslyWeakPassword(),
                new NotRecentlyUsedPassword($user->id, 5),
            ],
        ], [
            'password.regex' => 'Password must include at least one lowercase letter and one number.',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $newHash = Hash::make($request->password);
        $user->update(['password' => $newHash]);

        PasswordHistory::create(['user_id' => $user->id, 'password_hash' => $newHash]);

        // Keep only the last 5 history rows per user.
        $keepIds = PasswordHistory::where('user_id', $user->id)->latest()->take(5)->pluck('id');
        PasswordHistory::where('user_id', $user->id)->whereNotIn('id', $keepIds)->delete();

        // A remembered device only ever shortcuts the 2FA step, never the
        // password — but if the password leaked, any device trusted under
        // it should stop being able to skip 2FA too.
        \App\Models\TrustedDevice::where('user_id', $user->id)->delete();

        // Log the password change without exposing any password content
        \App\Models\AuditLog::record(
            'password_changed',
            $user,
            'Password was changed'
        );

        return response()->json(['message' => 'Password updated.']);
    }

    /**
     * Only applicants go through the face-verification flow at all
     * (verifiers/admins never have a FaceVerification row — see
     * uploadAvatar()'s doc comment) — scoping to role here keeps this
     * gate from locking every non-applicant out of their own account.
     */
    private function needsFaceReverify($user): bool
    {
        if ($user->role !== 'applicant') {
            return false;
        }

        $activeConfig = ApplicationConfiguration::where('is_active', true)->first();
        if (!$activeConfig) {
            return false;
        }

        $verification = FaceVerification::where('user_id', $user->id)->first();

        return !$verification || $verification->verified_config_id !== $activeConfig->id;
    }

    private function validateProfile(Request $request): array
    {
        return $request->validate([
            'birthdate'              => 'nullable|date',
            'gender'                 => 'nullable|in:male,female,other',
            'civil_status'           => 'nullable|in:single,married,widowed,separated',
            'house_no'               => 'nullable|string',
            'street'                 => 'nullable|string',
            'purok_type'             => 'nullable|in:purok,phase',
            'purok'                  => 'nullable|string',
            'subdivision'            => 'nullable|string|required_if:purok_type,phase',
            'barangay'               => 'nullable|string',
            'city'                   => 'nullable|string',
            'province'               => 'nullable|string',
            'guardian_first_name'    => 'nullable|string',
            'guardian_middle_name'   => 'nullable|string',
            'guardian_last_name'     => 'nullable|string',
            'guardian_relationship'  => 'nullable|string',
            'guardian_contact'       => 'nullable|string',
        ]);
    }
}