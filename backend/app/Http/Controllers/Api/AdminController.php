<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    public function stats()
    {
        return response()->json([
            'total'    => Application::count(),
            'pending'  => Application::whereIn('status', ['pending_prescreening', 'for_review'])->count(),
            'approved' => Application::where('status', 'approved')->count(),
            'rejected' => Application::where('status', 'rejected')->count(),
        ]);
    }

    public function users(Request $request)
    {
        $applicants = User::where('role', 'applicant')
            ->select('id', 'first_name', 'last_name', 'email', 'role', 'is_active', 'created_at')
            ->get();

        $personnel = User::whereIn('role', ['sk_verifier', 'sk_admin'])
            ->select('id', 'first_name', 'last_name', 'email', 'role', 'is_active', 'created_at')
            ->get();

        return response()->json([
            'applicants' => $applicants,
            'personnel'  => $personnel,
        ]);
    }

    public function createPersonnel(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string',
            'last_name'  => 'required|string',
            'email'      => 'required|email|unique:users,email',
            'role'       => 'required|in:sk_verifier,sk_admin',
            'password'   => 'required|string|min:8|confirmed',
            'is_active'  => 'boolean',
        ]);

        $user = User::create([
            'first_name' => $request->first_name,
            'last_name'  => $request->last_name,
            'email'      => $request->email,
            'role'       => $request->role,
            'password'   => Hash::make($request->password),
            'is_active'  => $request->is_active ?? true,
        ]);

        return response()->json(['message' => 'Personnel created.', 'user' => $user], 201);
    }

    public function updateUser(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $data = $request->validate([
            'first_name' => 'sometimes|string',
            'last_name'  => 'sometimes|string',
            'email'      => 'sometimes|email|unique:users,email,' . $id,
            'role'       => 'sometimes|in:sk_verifier,sk_admin',
            'is_active'  => 'sometimes|boolean',
            'password'   => 'sometimes|string|min:8|confirmed',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        return response()->json(['message' => 'User updated.', 'user' => $user]);
    }

    public function toggleStatus($id)
    {
        $user = User::findOrFail($id);
        $user->update(['is_active' => !$user->is_active]);

        return response()->json([
            'message'   => 'Status updated.',
            'is_active' => $user->is_active,
        ]);
    }

    public function deleteUser($id)
    {
        User::findOrFail($id)->delete();
        return response()->json(['message' => 'User deleted.']);
    }
}