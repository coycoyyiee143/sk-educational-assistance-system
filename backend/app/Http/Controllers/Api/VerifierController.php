<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\VerifierAction;
use App\Models\ClaimingAssignment;
use App\Notifications\ApplicationStatusNotification;
use Illuminate\Http\Request;

class VerifierController extends Controller
{
    public function stats()
    {
        return response()->json([
            'pending'  => Application::whereIn('status', ['pending_prescreening'])->count(),
            'review'   => Application::where('status', 'for_review')->count(),
            'approved' => Application::where('status', 'approved')->count(),
            'rejected' => Application::where('status', 'rejected')->count(),
        ]);
    }

    public function index(Request $request)
    {
        $applications = Application::with(['user'])
            ->orderBy('submitted_at', 'desc')
            ->get()
            ->map(function ($app) {
                return [
                    'id'             => $app->id,
                    'control_number' => $app->control_number,
                    'name'           => $app->user->first_name . ' ' . $app->user->last_name,
                    'submitted_at'   => $app->submitted_at,
                    'status'         => $app->status,
                    'school_name'    => $app->school_name,
                ];
            });

        return response()->json($applications);
    }

    public function show($id)
    {
        $app = Application::with([
            'user.profile',
            'documents.ocrResult',
            'verificationChecks',
            'configuration',
            'verifierActions' => function($q) {
                $q->latest()->limit(1);
            },
        ])->findOrFail($id);

        return response()->json($app);
    }

    public function approve(Request $request, $id)
    {
        // Eager-loaded user relationship to make sure notification finds the recipient email
        $app = Application::with('user')->findOrFail($id);

        $app->update([
            'status'         => 'approved',
            'control_number' => $app->control_number ?? \App\Models\Application::generateControlNumber($app->config_id),
        ]);

        VerifierAction::create([
            'application_id' => $app->id,
            'verifier_id'    => $request->user()->id,
            'action'         => 'approved',
            'notes'          => $request->notes ?? null,
        ]);

        // Trigger Approval Notification
        $app->user->notify(new ApplicationStatusNotification(
            'Approved',
            'Congratulations! Your application has been approved. Please wait for announcements regarding the physical document submission and distribution schedule.'
        ));

        return response()->json(['message' => 'Application approved.']);
    }

    public function reject(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string']);

        // Eager-loaded user relationship
        $app = Application::with('user')->findOrFail($id);
        
        $app->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
        ]);

        VerifierAction::create([
            'application_id' => $app->id,
            'verifier_id'    => $request->user()->id,
            'action'         => 'rejected',
            'notes'          => $request->reason,
        ]);

        // Trigger Rejection Notification
        $app->user->notify(new ApplicationStatusNotification(
            'Rejected',
            'We regret to inform you that your educational assistance application was not approved. Reason: ' . $request->reason
        ));

        return response()->json(['message' => 'Application rejected.']);
    }

    public function requestReupload(Request $request, $id)
    {
        $request->validate([
            'notes'            => 'required|string',
            'reupload_details' => 'nullable|array',
        ]);

        // Eager-loaded user relationship
        $app = Application::with('user')->findOrFail($id);
        
        $app->update(['status' => 'reupload_requested']);

        VerifierAction::create([
            'application_id'  => $app->id,
            'verifier_id'     => $request->user()->id,
            'action'          => 'reupload_requested',
            'notes'           => $request->notes,
            'reupload_details'=> $request->reupload_details ?? [],
        ]);

        // Trigger Re-upload Notification
        $app->user->notify(new ApplicationStatusNotification(
            'Re-upload Requested',
            'The verifier reviewed your submission and flagged some missing or unreadable documents. Please review these notes: ' . $request->notes
        ));

        return response()->json(['message' => 'Re-upload requested.']);
    }

    public function searchClaiming(Request $request)
    {
        $controlNumber = $request->query('control_number');
        $name          = $request->query('name');

        $query = Application::with(['user', 'documents', 'claimingAssignment.lane'])
            ->whereIn('status', ['approved', 'claimed', 'not_cleared', 'unclaimed'])
            ->whereHas('claimingAssignment');

        if ($controlNumber) {
            $query->where('control_number', 'like', "%{$controlNumber}%");
        }

        if ($name) {
            $query->whereHas('user', function ($q) use ($name) {
                $q->where('first_name', 'like', "%{$name}%")
                ->orWhere('last_name', 'like', "%{$name}%");
            });
        }

        $results = $query->get();

        if ($results->isEmpty()) {
            return response()->json(['message' => 'No matching approved applicant found.'], 404);
        }

        return response()->json($results);
    }

    public function updateClaimStatus(Request $request, $id)
    {
        $request->validate([
            'claim_status'       => 'required|in:claimed,not_cleared,unclaimed',
            'verified_documents' => 'nullable|array',
            'notes'              => 'nullable|string',
        ]);

        $assignment = ClaimingAssignment::where('application_id', $id)->firstOrFail();

        $assignment->update([
            'claim_status'       => $request->claim_status,
            'verified_documents' => $request->verified_documents ?? [],
            'verifier_notes'     => $request->notes,
            'verified_by'        => $request->user()->id,
            'verified_at'        => now(),
        ]);

        $app = Application::with('user')->findOrFail($id);
        $app->update(['status' => $request->claim_status]);

        $messages = [
            'claimed'     => 'You have successfully claimed your educational assistance. Thank you!',
            'not_cleared' => 'Your physical documents did not match your application record on claiming day.',
            'unclaimed'   => 'You were marked as unclaimed for your assigned claiming schedule. Please coordinate with the SK office regarding the grace period.',
        ];
        $labels = [
            'claimed'     => 'Claimed',
            'not_cleared' => 'Not Cleared',
            'unclaimed'   => 'Unclaimed',
        ];

        $app->user->notify(new ApplicationStatusNotification(
            $labels[$request->claim_status],
            $messages[$request->claim_status]
        ));

        return response()->json(['message' => 'Claiming status updated.', 'assignment' => $assignment]);
    }
}