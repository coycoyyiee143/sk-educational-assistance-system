<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use Illuminate\Http\Request;

class ApplicationController extends Controller
{
    public function index(Request $request)
    {
        $applications = Application::where('user_id', $request->user()->id)
            ->with(['configuration', 'documents', 'latestVerifierAction'])
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
        if (now()->lt($config->open_date)) {
            return response()->json(['message' => 'This application period has not opened yet.'], 400);
        }
        if (now()->gt($config->close_date)) {
            return response()->json(['message' => 'This application period has closed.'], 400);
        }
        if (!$config->is_unlimited && $config->slots_filled >= $config->slot_limit) {
            return response()->json(['message' => 'No more slots available.'], 400);
        }
        $profile = $request->user()->profile;
        if (!$profile || !$profile->birthdate) {
            return response()->json([
                'message' => 'Please complete your profile (date of birth) before applying.',
            ], 400);
        }
        if ($profile->is_minor && !$profile->hasCompleteGuardianInfo()) {
            return response()->json([
                'message' => 'As a minor applicant, please complete your guardian information (name and relationship) in your profile before applying.',
            ], 400);
        }

                // Duplicate-applicant check: block a new registration if the person's
        // first name + last name + birthdate already matches someone who has
        // an approved or claimed application on file — regardless of which
        // account/email they used to apply. Middle name is deliberately
        // excluded from the match, since it is often left blank or entered
        // inconsistently between accounts, which would otherwise let a
        // duplicate slip through undetected.
        $normalizedFirstName = strtolower(trim($request->user()->first_name));
        $normalizedLastName = strtolower(trim($request->user()->last_name));

        $possibleDuplicates = \App\Models\User::where('id', '!=', $request->user()->id)
            ->whereHas('profile', function ($q) use ($profile) {
                $q->where('birthdate', $profile->birthdate);
            })
            ->get()
            ->filter(function ($otherUser) use ($normalizedFirstName, $normalizedLastName) {
                return strtolower(trim($otherUser->first_name)) === $normalizedFirstName
                    && strtolower(trim($otherUser->last_name)) === $normalizedLastName;
            });

        if ($possibleDuplicates->isNotEmpty()) {
            $duplicateHasReceivedAssistance = Application::whereIn('user_id', $possibleDuplicates->pluck('id'))
                ->whereIn('status', ['approved', 'claimed'])
                ->exists();

            if ($duplicateHasReceivedAssistance) {
                return response()->json([
                    'message' => 'An application matching your name and date of birth has already received educational assistance under a different account. Please contact the SK office if you believe this is an error.',
                ], 400);
            }
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
        \App\Models\AuditLog::record(
            'application_submitted',
            $application,
            "You submitted an application."
        );
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
            'school_name'          => 'required|string',
            'school_address'       => 'nullable|string',
            'course'               => 'required|string',
            'year_level'           => 'required|string',
            'student_id_number'    => 'nullable|string',
            'attestation_accepted' => 'nullable|boolean',
        ]);
        $updateData = [
            'school_name'       => $request->school_name,
            'school_address'    => $request->school_address,
            'course'            => $request->course,
            'year_level'        => $request->year_level,
            'student_id_number' => $request->student_id_number,
        ];
        // Only stamp attestation_accepted_at the first time it's confirmed —
        // never overwrite an existing timestamp on subsequent edits.
        if ($request->boolean('attestation_accepted') && !$application->attestation_accepted_at) {
            $updateData['attestation_accepted_at'] = now();
        }
        $application->update($updateData);
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