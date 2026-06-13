<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\VerifierAction;
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
            'control_number' => $app->control_number ?? ('SK-' . date('Y') . '-' . strtoupper(substr(uniqid(), -6))),
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
            'Congratulations! Your application has been verified and approved by the SK Verifier. Please wait for announcements regarding the physical document submission and distribution schedule.'
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
}