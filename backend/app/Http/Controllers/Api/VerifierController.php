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
            'pending'  => Application::whereIn('status', ['pending_prescreening'])->whereHas('documents')->count(),
            'review'   => Application::where('status', 'for_review')->count(),
            'approved' => Application::where('status', 'approved')->count(),
            'rejected' => Application::where('status', 'rejected')->count(),
        ]);
    }

    public function index(Request $request)
    {
        $applications = Application::with(['user', 'verifierActions'])
            ->whereHas('documents')
            ->orderBy('updated_at', 'desc')   // CHANGED: was submitted_at — re-uploads now surface by recent activity
            ->get()
            ->map(function ($app) {
                return [
                    'id'                => $app->id,
                    'control_number'    => $app->control_number,
                    'name'              => $app->user->first_name . ' ' . $app->user->last_name,
                    'submitted_at'      => $app->submitted_at,
                    'updated_at'        => $app->updated_at,
                    'status'            => $app->status,
                    'school_name'       => $app->school_name,
                    'verifier_actions'  => $app->verifierActions->map(fn($a) => ['action' => $a->action]),
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
        $app = Application::with(['user', 'configuration'])->findOrFail($id);
        if ($app->status === 'approved') {
            return response()->json(['message' => 'Application already approved.'], 400);
        }
    
        // Prevent approving past the configured slot limit. Not fully race-condition-safe
        // for simultaneous approvals, but closes the gap where no check existed at all.
        $config = $app->configuration;
        if (!$config->is_unlimited && $config->slots_filled >= $config->slot_limit) {
            return response()->json(['message' => 'No more slots available for this application period.'], 400);
        }
    
        $app->update([
            'status'         => 'approved',
            'control_number' => $app->control_number ?? \App\Models\Application::generateControlNumber($app->config_id),
        ]);
         // Slot is consumed here, at approval time, not at submission.
         // This ensures slots_filled only reflects applicants who actually
         // passed eligibility verification.
        $app->configuration()->increment('slots_filled'); 
        VerifierAction::create([
            'application_id' => $app->id,
            'verifier_id'    => $request->user()->id,
            'action'         => 'approved',
            'notes'          => $request->notes ?? null,
        ]);
         // Log this approval for the audit trail
        \App\Models\AuditLog::record(
            'application_approved',
            $app,
            "Approved application #{$app->id} ({$app->user->first_name} {$app->user->last_name})"
        );
        // Trigger Approval Notification
        $app->user->notify(new ApplicationStatusNotification(
            'Approved',
            'Congratulations! Your application has been approved. Please wait for announcements regarding the physical document submission and distribution schedule.'
        ));
        return response()->json(['message' => 'Application approved.']);
    }

    public function reject(Request $request, $id)
    {
        $request->validate([
            'reason'              => 'required|string',
            'reason_categories'   => 'required|array|min:1',
            'reason_categories.*' => 'string',
        ]);
    
        $app = Application::with('user')->findOrFail($id);
    
        $app->update([
            'status'           => 'rejected',
            'rejection_reason' => $request->reason,
        ]);
    
        VerifierAction::create([
            'application_id'    => $app->id,
            'verifier_id'       => $request->user()->id,
            'action'            => 'rejected',
            'reason_categories' => $request->reason_categories,
            'notes'             => $request->reason,
        ]);
    
        \App\Models\AuditLog::record(
            'application_rejected',
            $app,
            "Rejected application #{$app->id}. Reason: {$request->reason}"
        );
    
        $app->user->notify(new ApplicationStatusNotification(
            'Rejected',
            'We regret to inform you that your educational assistance application was not approved. Reason: ' . $request->reason
        ));
    
        return response()->json(['message' => 'Application rejected.']);
    }
    
    public function requestReupload(Request $request, $id)
    {
        $request->validate([
            'notes'                                  => 'required|string',
            'reupload_details'                       => 'required|array|min:1',
            'reupload_details.*.document_type'       => 'required|string',
            'reupload_details.*.reason_categories'   => 'required|array|min:1',
            'reupload_details.*.reason_categories.*' => 'string',
            'reupload_details.*.reason'              => 'required|string',
        ]);
    
        $app = Application::with('user')->findOrFail($id);
    
        $app->update(['status' => 'reupload_requested']);
    
        VerifierAction::create([
            'application_id'   => $app->id,
            'verifier_id'      => $request->user()->id,
            'action'           => 'reupload_requested',
            'notes'            => $request->notes,
            'reupload_details' => $request->reupload_details,
        ]);
    
        \App\Models\AuditLog::record(
            'application_reupload_requested',
            $app,
            "Requested document re-upload for application #{$app->id}. Notes: {$request->notes}"
        );
    
        $app->user->notify(new ApplicationStatusNotification(
            'Re-upload Requested',
            'The verifier reviewed your submission and flagged some missing or unreadable documents. Please review these notes: ' . $request->notes
        ));
    
        return response()->json(['message' => 'Re-upload requested.']);
    }
    
    public function updateClaimStatus(Request $request, $id)
    {
        $request->validate([
            'claim_status'          => 'required|in:claimed,not_cleared,unclaimed',
            'reason_categories'     => 'required_if:claim_status,not_cleared|nullable|array',
            'reason_categories.*'   => 'string',
            'verified_documents'    => 'nullable|array',
            'notes'                 => 'nullable|string',
        ]);
    
        $assignment = ClaimingAssignment::where('application_id', $id)->firstOrFail();
        $assignment->update([
            'claim_status'       => $request->claim_status,
            'reason_categories'  => $request->claim_status === 'not_cleared' ? $request->reason_categories : null,
            'verified_documents' => $request->verified_documents ?? [],
            'verifier_notes'     => $request->notes,
            'verified_by'        => $request->user()->id,
            'verified_at'        => now(),
        ]);
    
        $app = Application::with('user')->findOrFail($id);
        $app->update(['status' => $request->claim_status]);
    
        \App\Models\AuditLog::record(
            'claim_status_updated',
            $app,
            "Marked application #{$app->id} as {$request->claim_status}"
        );
    
        $messages = [
            'claimed'     => 'You have successfully claimed your educational assistance. Thank you!',
            'not_cleared' => 'Your physical documents did not match your application record on claiming day. Please contact the SK office for further assistance.',
            'unclaimed'   => 'The claiming period has passed and your assistance was not claimed within the grace period. Please coordinate with the SK office.',
        ];
        $labels = [
            'claimed'     => 'Claimed',
            'not_cleared' => 'Rejected — Document Mismatch at Claiming',
            'unclaimed'   => 'Unclaimed',
        ];
    
        $app->user->notify(new ApplicationStatusNotification(
            $labels[$request->claim_status],
            $messages[$request->claim_status]
        ));
    
        return response()->json(['message' => 'Claiming status updated.', 'assignment' => $assignment]);
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

    // Returns the logged-in verifier's own activity history
    public function activityLog(Request $request)
    {
        $logs = \App\Models\AuditLog::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }
}