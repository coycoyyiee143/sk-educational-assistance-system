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

        $changes = $user->getChanges();
        unset($changes['updated_at'], $changes['password']);

        if (!empty($changes)) {
            $fieldList = implode(', ', array_keys($changes));   
            \App\Models\AuditLog::record(
                'personnel_updated',
                $user,
                "Updated {$user->first_name} {$user->last_name}'s fields: {$fieldList}"
            );
        }

        return response()->json(['message' => 'User updated.', 'user' => $user]);  
    }

    public function toggleStatus($id)
    {
        $user = User::findOrFail($id);
        $user->update(['is_active' => !$user->is_active]);

        $statusLabel = $user->is_active ? 'activated' : 'deactivated';
        \App\Models\AuditLog::record(
            'personnel_status_changed',
            $user,
            "{$statusLabel} account: {$user->first_name} {$user->last_name}"
        );

        return response()->json([
            'message'   => 'Status updated.',
            'is_active' => $user->is_active,
        ]);
    }

    public function deleteUser($id)
    {
        $user = User::findOrFail($id);
        $name = "{$user->first_name} {$user->last_name}";
        $email = $user->email;

        $user->delete();

        // Note: no $subject model passed since the record is now deleted
        \App\Models\AuditLog::record(
            'personnel_deleted',
            null,
            "Deleted account: {$name} ({$email})"
        );

        return response()->json(['message' => 'User deleted.']);
    }
    // Returns the logged-in admin's own activity history
    public function activityLog(Request $request)
    {
        $logs = \App\Models\AuditLog::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }

    // Returns ALL activity logs from Admin and Verifier accounts only.
    // Applicant logs are intentionally excluded from this view.
    public function masterActivityLog(Request $request)
    {
        $query = \App\Models\AuditLog::whereHas('user', function ($q) {
            $q->whereIn('role', ['sk_admin', 'sk_verifier']);
        })->with('user:id,first_name,last_name,email,role');

        // Optional filter: ?role=sk_verifier or ?role=sk_admin
        if ($request->has('role') && in_array($request->role, ['sk_admin', 'sk_verifier'])) {
            $query->whereHas('user', function ($q) use ($request) {
                $q->where('role', $request->role);
            });
        }

        $logs = $query->latest()->paginate(50);

        return response()->json($logs);
    }
}