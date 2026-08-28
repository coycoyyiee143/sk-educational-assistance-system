<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
        $data = $this->validateProfile($request);
        $profile = $request->user()->profile;

        // Recompute completeness on every update — a profile becomes
        // "complete" once these core fields are filled in, regardless of
        // whether it was set via store() (first-time setup) or here (later edits).
        $data['is_profile_complete'] = (bool) (
            ($data['birthdate'] ?? null) &&
            ($data['gender'] ?? null) &&
            ($data['civil_status'] ?? null) &&
            ($data['house_no'] ?? null) &&
            ($data['street'] ?? null) &&
            ($data['purok_type'] ?? null) &&
            ($data['purok'] ?? null) &&
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
                "You updated your profile information"
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
                "You updated your profile information"
            );
        }

        return response()->json(['message' => 'Account updated.', 'user' => $user]);
    }

    public function updatePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($request->current_password, $request->user()->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $request->user()->update(['password' => Hash::make($request->password)]);

        // Log the password change without exposing any password content
        \App\Models\AuditLog::record(
            'password_changed',
            $request->user(),
            'Password was changed'
        );

        return response()->json(['message' => 'Password updated.']);
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