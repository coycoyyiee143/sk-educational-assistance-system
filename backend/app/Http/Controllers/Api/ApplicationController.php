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

        if ($config->used_slots >= $config->total_slots) {
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

        $config->increment('used_slots');

        // Trigger Submission Confirmation Notification
        $request->user()->notify(new ApplicationStatusNotification(
            'Pending Pre-screening',
            'Your educational assistance application has been submitted successfully and queued for digital document verification.'
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
}