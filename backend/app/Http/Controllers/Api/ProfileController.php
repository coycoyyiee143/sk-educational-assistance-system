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

        return response()->json([
            'message' => 'Profile saved.',
            'profile' => $profile,
        ], 201);
    }

    public function update(Request $request)
    {
        $data = $this->validateProfile($request);

        $request->user()->profile()->update($data);

        return response()->json([
            'message' => 'Profile updated.',
            'profile' => $request->user()->profile,
        ]);
    }

    public function updateAccount(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'first_name'    => 'sometimes|string',
            'last_name'     => 'sometimes|string',
            'mobile_number' => 'sometimes|string|unique:users,mobile_number,' . $user->id,
        ]);

        $user->update($data);

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

        return response()->json(['message' => 'Password updated.']);
    }

    private function validateProfile(Request $request): array
    {
        return $request->validate([
            'birthdate'             => 'required|date',
            'gender'                => 'required|in:male,female,other',
            'civil_status'          => 'required|in:single,married,widowed,separated',
            'house_no'              => 'nullable|string',
            'street'                => 'nullable|string',
            'purok'                 => 'nullable|string',
            'barangay'              => 'required|string',
            'city'                  => 'required|string',
            'province'              => 'required|string',
            'guardian_name'         => 'nullable|string',
            'guardian_relationship' => 'nullable|string',
            'guardian_contact'      => 'nullable|string',
        ]);
    }
}