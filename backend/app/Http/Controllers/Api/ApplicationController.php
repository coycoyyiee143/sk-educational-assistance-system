<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Notifications\ApplicationStatusNotification;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    public function index(Request $request)
    {
        $applications = Application::where('user_id', $request->user()->id)
            ->with(['documents', 'latestVerifierAction'])
            ->latest()
            ->get();

        return response()->json($applications);
    }

    public function store(Request $request)
    {
        $request->validate([
            'school_name'       => 'required|string',
            'school_address'    => 'nullable|string',
            'course'            => 'required|string',
            'year_level'        => 'required|string',
            'student_id_number' => 'nullable|string',
        ]);

        $config = ApplicationConfiguration::where('is_active', true)->first();

        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 400);
        }

        if (!$config->is_unlimited && $config->slots_filled >= $config->slot_limit) {
            return response()->json(['message' => 'No more slots available.'], 400);
        }

        // Check if user already applied this period
        $existing = Application::where('user_id', $request->user()->id)
            ->where('config_id', $config->id)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You already have an application for this period.'], 400);
        }

        $application = Application::create([
            'user_id'           => $request->user()->id,
            'config_id'         => $config->id,
            'school_name'       => $request->school_name,
            'school_address'    => $request->school_address,
            'course'            => $request->course,
            'year_level'        => $request->year_level,
            'student_id_number' => $request->student_id_number,
            'status'            => 'pending_prescreening',
            'submitted_at'      => now(),
        ]);
        // comment out the incrementing of slots_filled here because it should only be incremented when the application is approved, not when it is submitted.
        //$config->increment('slots_filled');

        // Log the application submission for the audit trail
        \App\Models\AuditLog::record(
            'application_submitted',
            $application,
            "Submitted application for {$application->school_name}"
        );

        // Trigger Submission Confirmation Notification
        $request->user()->notify(new ApplicationStatusNotification(
            'Pending',
            'Your educational assistance application has been submitted successfully and queued for document verification.'
        ));

        return response()->json([
            'message'     => 'Application submitted.',
            'application' => $application,
        ], 201);
    }

    public function show(Request $request, $id)
    {
        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with(['documents', 'verificationChecks'])
            ->firstOrFail();

        return response()->json($application);
    }

    public function update(Request $request, $id)
    {
        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        // Only allow edits before any document has actually been processed.
        if ($application->status !== 'pending_prescreening') {
            return response()->json([
                'message' => 'This application can no longer be edited because it has already entered document verification.',
            ], 400);
        }

        $request->validate([
            'school_name'       => 'required|string',
            'school_address'    => 'nullable|string',
            'course'            => 'required|string',
            'year_level'        => 'required|string',
            'student_id_number' => 'nullable|string',
        ]);

        $application->update([
            'school_name'       => $request->school_name,
            'school_address'    => $request->school_address,
            'course'            => $request->course,
            'year_level'        => $request->year_level,
            'student_id_number' => $request->student_id_number,
        ]);

        // Log the application edit for the audit trail
        \App\Models\AuditLog::record(
            'application_updated',
            $application,
            "Updated application details for {$application->school_name}"
        );

        return response()->json([
            'message'     => 'Application updated.',
            'application' => $application,
        ]);
    }

    public function claimingSchedule(Request $request)
    {
        $application = Application::where('user_id', $request->user()->id)
            ->with(['user', 'claimingAssignment.lane', 'claimingAssignment.schedule'])
            ->latest()
            ->first();

        if (!$application || !$application->claimingAssignment) {
            return response()->json(['message' => 'No claiming schedule assigned yet.'], 404);
        }

        return response()->json([
            'application' => $application,
            'assignment'  => $application->claimingAssignment,
        ]);
    }

    // Returns the logged-in applicant's own activity history
    public function activityLog(Request $request)
    {
        $logs = \App\Models\AuditLog::where('user_id', $request->user()->id)
            ->latest()
            ->paginate(50);

        return response()->json($logs);
    }
}



