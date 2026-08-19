<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\VerifierAction;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Notifications\ClaimingScheduleNotification;
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

        $outcome = Application::tryApprove($app);

        if ($outcome['result'] === 'no_slots') {
            Application::moveToWaitlist($app);

            $app->user->notify(new ApplicationStatusNotification(
                'Waitlisted',
                "Your application met all requirements, but all slots for this period are currently filled. This does not guarantee a slot — you will only be approved if a slot opens up. If a slot opens, we will notify you before the grace period ends."
            ));

            return response()->json(['message' => 'No slots available — applicant added to waitlist instead.']);
        }

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

    public function promoteFromWaitlist(Request $request, $configId)
    {
        $outcome = Application::promoteNextFromWaitlist($configId);
    
        if ($outcome['result'] === 'no_waitlist') {
            return response()->json(['message' => 'No waitlisted applicants available to promote.'], 400);
        }
    
        if ($outcome['result'] === 'no_slots') {
            return response()->json(['message' => 'No slots available to promote into.'], 400);
        }
    
        $promoted = $outcome['application'];
    
        \App\Models\AuditLog::record(
            'application_approved',
            $promoted,
            "Promoted application #{$promoted->id} from waitlist ({$promoted->user->first_name} {$promoted->user->last_name})"
        );
    
        $schedule = ClaimingSchedule::where('config_id', $configId)
            ->where('is_published', true)
            ->latest()
            ->first();
    
        if ($schedule && $schedule->grace_period_date) {
            $lane = ClaimingLane::firstOrCreate(
                [
                    'claiming_schedule_id' => $schedule->id,
                    'lane_name'            => 'Waitlist Promotions',
                ],
                [
                    'batch'         => 'morning',
                    'claiming_date' => $schedule->grace_period_date,
                    'capacity'      => null,
                ]
            );
    
            $assignment = ClaimingAssignment::updateOrCreate(
                ['application_id' => $promoted->id],
                [
                    'claiming_schedule_id' => $schedule->id,
                    'claiming_lane_id'     => $lane->id,
                    'claim_status'         => 'pending',
                    'source'               => 'waitlist_promotion',
                ]
            );
    
            $promoted->user->notify(new ClaimingScheduleNotification($promoted, $lane, $schedule, $assignment));
        } else {
            $promoted->user->notify(new ApplicationStatusNotification(
                'Approved',
                'A slot has opened up and your application has now been approved! Please prepare your physical documents for submission.'
            ));
        }
    
        return response()->json(['message' => 'Applicant promoted from waitlist.', 'application' => $promoted]);
    }
    
    public function promoteAllFromWaitlist(Request $request, $configId)
    {
        $waitlistExists = Application::where('config_id', $configId)
            ->where('status', 'waitlisted')
            ->exists();
    
        if (!$waitlistExists) {
            return response()->json(['message' => 'No waitlisted applicants available to promote.'], 400);
        }
    
        $promotedList = Application::promoteAllFromWaitlist($configId);
    
        if (empty($promotedList)) {
            return response()->json(['message' => 'No slots available to promote into.'], 400);
        }
    
        $schedule = ClaimingSchedule::where('config_id', $configId)
            ->where('is_published', true)
            ->latest()
            ->first();
    
        foreach ($promotedList as $promoted) {
            \App\Models\AuditLog::record(
                'application_approved',
                $promoted,
                "Promoted application #{$promoted->id} from waitlist ({$promoted->user->first_name} {$promoted->user->last_name})"
            );
    
            if ($schedule && $schedule->grace_period_date) {
                $lane = ClaimingLane::firstOrCreate(
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'lane_name'            => 'Waitlist Promotions',
                    ],
                    [
                        'batch'         => 'morning',
                        'claiming_date' => $schedule->grace_period_date,
                        'capacity'      => null,
                    ]
                );
    
                $assignment = ClaimingAssignment::updateOrCreate(
                    ['application_id' => $promoted->id],
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'claiming_lane_id'     => $lane->id,
                        'claim_status'         => 'pending',
                        'source'               => 'waitlist_promotion',
                    ]
                );
    
                $promoted->user->notify(new ClaimingScheduleNotification($promoted, $lane, $schedule, $assignment));
            } else {
                $promoted->user->notify(new ApplicationStatusNotification(
                    'Approved',
                    'A slot has opened up and your application has now been approved! Please prepare your physical documents for submission.'
                ));
            }
        }
    
        $count = count($promotedList);
    
        return response()->json([
            'message' => "{$count} applicant(s) promoted from waitlist.",
            'applications' => $promotedList,
        ]);
    }

    /**
     * Lists the active period's waitlist in promotion order, so a verifier
     * can see who's waiting and how long — promotion itself always pulls
     * the #1 position (strict FIFO via promoteNextFromWaitlist), so this
     * view is informational, not a picker.
     */
    public function waitlist(Request $request)
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();
    
        if (!$config) {
            return response()->json(['config_id' => null, 'waitlist' => [], 'not_cleared_count' => 0, 'free_slots' => 0]);
        }
    
        $waitlisted = Application::with('user')
            ->where('config_id', $config->id)
            ->where('status', 'waitlisted')
            ->orderBy('waitlisted_at')
            ->get()
            ->values()
            ->map(function ($app, $index) {
                return [
                    'id'            => $app->id,
                    'name'          => trim($app->user->first_name . ' ' . $app->user->last_name),
                    'school_name'   => $app->school_name,
                    'waitlisted_at' => $app->waitlisted_at,
                    'position'      => $index + 1,
                ];
            });
    
        // Historical count — how many not_cleared outcomes this period has had
        // in total, used only as the denominator for context.
        $notClearedCount = \App\Models\ClaimingAssignment::where('claim_status', 'not_cleared')
            ->whereHas('application', fn($q) => $q->where('config_id', $config->id))
            ->count();
    
        // Live count — slots_filled correctly reflects every promotion
        // (increments) and every not_cleared/unclaimed (decrements), so this
        // is always accurate right now, unlike a static count of past events.
        $freeSlots = $config->is_unlimited ? null : max(0, $config->slot_limit - $config->slots_filled);
    
        return response()->json([
            'config_id'          => $config->id,
            'waitlist'           => $waitlisted,
            'not_cleared_count'  => $notClearedCount,
            'free_slots'         => $freeSlots,
        ]);
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

        $app = Application::with(['user', 'configuration'])->findOrFail($id);
        $previousStatus = $app->status;

        $app->update(['status' => $request->claim_status]);

        // Both not_cleared (decided immediately on claiming day) and
        // unclaimed (decided once grace period fully lapses with no show)
        // are terminal negative outcomes that free the reserved slot for
        // reporting/accounting purposes. Guarded against double-decrementing
        // if this endpoint is called again with the same status.
        //
        // Note: freeing the slot here does NOT automatically trigger a
        // waitlist promotion — that stays a manual verifier/admin action
        // via promoteFromWaitlist(). By team decision, only not_cleared
        // slots are actively offered to the waitlist during grace period;
        // unclaimed slots are left unfilled for the cycle rather than
        // chased down after grace period ends.
        $terminalNegative = ['not_cleared', 'unclaimed'];

        if (in_array($request->claim_status, $terminalNegative) && !in_array($previousStatus, $terminalNegative)) {
            $app->configuration()->decrement('slots_filled');
        }

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