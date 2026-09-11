<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\PasswordHistory;
use App\Mail\PersonnelAccountMail;
use App\Rules\NotObviouslyWeakPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;

class AdminController extends Controller
{
    public function stats()
    {
        $activeConfig = ApplicationConfiguration::where('is_active', true)->first();
    
        if (!$activeConfig) {
            return response()->json([
                'total'      => 0,
                'incomplete' => 0,
                'pending'    => 0,
                'approved'   => 0,
                'rejected'   => 0,
                'no_active_period' => true,
            ]);
        }
    
        return response()->json([
            'total'      => Application::where('config_id', $activeConfig->id)->whereHas('documents')->count(),
            'incomplete' => Application::where('config_id', $activeConfig->id)->whereDoesntHave('documents')->count(),
            'pending'    => Application::where('config_id', $activeConfig->id)->whereIn('status', ['pending_prescreening', 'for_review'])->count(),
            'approved'   => Application::where('config_id', $activeConfig->id)->where('status', 'approved')->count(),
            'rejected'   => Application::where('config_id', $activeConfig->id)->where('status', 'rejected')->count(),
            'no_active_period' => false,
        ]);
    }

    public function users(Request $request)
    {
        $applicants = User::where('role', 'applicant')
            ->select('id', 'first_name', 'last_name', 'email', 'role', 'is_active', 'created_at', 'privacy_consent_at')
            ->with(['faceVerification:id,user_id,status,registration_match_score,verified_at'])
            ->get();

        $personnel = User::whereIn('role', ['sk_verifier', 'sk_admin'])
            ->select('id', 'first_name', 'last_name', 'email', 'role', 'is_active', 'created_at', 'email_verified_at')
            ->get();

        return response()->json([
            'applicants' => $applicants,
            'personnel'  => $personnel,
        ]);
    }

    /**
     * Creates a verifier/admin account with NO password of the admin's
     * choosing. The account gets an unguessable placeholder password
     * (nobody knows it, not even the creating admin) and a one-time
     * setup link is emailed instead — the new person sets their own
     * password by clicking it. Also doubles as email verification for
     * that account, since clicking the link proves ownership of the
     * inbox.
     */
    public function createPersonnel(Request $request)
    {
        $request->validate([
            'first_name' => 'required|string',
            'last_name'  => 'required|string',
            'email'      => 'required|email|unique:users,email',
            'role'       => 'required|in:sk_verifier,sk_admin',
            'is_active'  => 'boolean',
        ]);

        $token = Str::random(64);

        $user = User::create([
            'first_name' => $request->first_name,
            'last_name'  => $request->last_name,
            'email'      => $request->email,
            'role'       => $request->role,
            // Unguessable placeholder — nobody, including the admin who
            // just created this account, knows this value. The account
            // is completely unusable until the setup link is clicked.
            'password'   => Hash::make(Str::random(40)),
            'is_active'  => $request->is_active ?? true,
        ]);

        // forceFill, not part of the create() array above — these
        // columns likely aren't in $fillable (they're a newer addition
        // to the users table), and create() silently drops anything
        // not in $fillable rather than erroring. forceFill bypasses
        // that, so the token actually gets saved.
        $user->forceFill([
            'verification_token'            => $token,
            'verification_token_expires_at' => now()->addDays(3),
        ])->save();

        $setupUrl = rtrim(config('app.frontend_url', config('app.url')), '/') . "/personnel/setup/{$token}";
        // send(), not queue() — this only listens to the notifications/
        // ocr queues on the server, so anything queued to the default
        // queue would sit unsent unless QUEUE_CONNECTION=sync. Account
        // creation is low-volume enough that sending synchronously here
        // is fine and removes this whole class of silent-failure bug.
        Mail::to($user->email)->send(new PersonnelAccountMail($user->first_name, $setupUrl, true));

        \App\Models\AuditLog::record(
            'personnel_created',
            $user,
            "Created {$user->role} account for {$user->first_name} {$user->last_name}, setup link sent"
        );

        return response()->json(['message' => 'Personnel account created. A setup link has been emailed to them.', 'user' => $user], 201);
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
        ]);

        $user->update($data);

        $changes = $user->getChanges();
        unset($changes['updated_at']);

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

    /**
     * Admin-initiated password reset for a verifier or admin account.
     * Same mechanism as account creation: the account's password is
     * immediately replaced with an unguessable placeholder (killing
     * the old password right away, no grace period), all existing
     * sessions are revoked, and a one-time setup link is emailed. The
     * admin performing this never sees or chooses the new password —
     * only the account owner sets it, by clicking the link.
     *
     * Deliberately scoped to sk_verifier/sk_admin only — applicants
     * use the existing self-service PasswordResetController flow.
     *
     * Also blocks an admin from resetting their OWN account this way —
     * this action kills the current password and revokes all sessions
     * immediately, which would lock the admin out of their own account
     * mid-action with no recovery path except the email link (and if
     * that email is fake/unreachable, permanently). Self-service
     * password changes already exist via PUT /user/password — that's
     * the correct path for an admin changing their own password.
     */
    public function resetPassword(Request $request, $id)
    {
        $user = User::findOrFail($id);

        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => "You can't reset your own password this way — use Change Password in your account settings instead.",
            ], 422);
        }

        if (!in_array($user->role, ['sk_verifier', 'sk_admin'])) {
            return response()->json([
                'message' => 'This action is only available for verifier and admin accounts.',
            ], 422);
        }

        $token = Str::random(64);

        $user->forceFill([
            'password'                       => Hash::make(Str::random(40)),
            'verification_token'             => $token,
            'verification_token_expires_at'  => now()->addDays(3),
            'failed_login_attempts'          => 0,
            'locked_until'                   => null,
        ])->save();

        // Revoke all existing sessions immediately — the old password
        // is already dead, but any tokens issued under it should die
        // too, not linger until they naturally expire.
        $user->tokens()->delete();

        $setupUrl = rtrim(config('app.frontend_url', config('app.url')), '/') . "/personnel/setup/{$token}";
        Mail::to($user->email)->send(new PersonnelAccountMail($user->first_name, $setupUrl, false));

        \App\Models\AuditLog::record(
            'personnel_password_reset',
            $user,
            "Password reset by admin for {$user->first_name} {$user->last_name} ({$user->role}), setup link sent"
        );

        return response()->json([
            'message' => 'Password reset. A link to set a new password has been emailed to the account owner.',
        ]);
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

        try {
            $user->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            // Error code 23000 = foreign key constraint violation. This
            // account has real activity tied to it (posted an
            // announcement, approved an application, verified a claim,
            // etc.) — deleting it would orphan that history. Deactivate
            // instead, which removes login access without destroying
            // the accountability trail.
            if ($e->getCode() === '23000') {
                return response()->json([
                    'message' => "Can't delete {$name} — this account has activity history (posts, approvals, verifications, etc.) tied to it. Deactivate the account instead to remove access while preserving records.",
                ], 409);
            }

            throw $e;
        }

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