<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\FaceVerification;
use App\Services\FaceMatchingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class FaceVerificationController extends Controller
{
    protected FaceMatchingService $faceService;

    public function __construct(FaceMatchingService $faceService)
    {
        $this->faceService = $faceService;
    }

    /**
     * REGISTRATION STEP
     * Applicant uploads a valid ID + a live cam capture. We compare them,
     * and if they match, store the resulting face embedding for later use
     * on claiming day. Called right after /register, using the auth token
     * that /register already returned.
     */
    public function store(Request $request)
    {
        $request->validate([
            'id_image'   => 'required|file|mimes:jpg,jpeg,png|max:5120',
            'live_photo' => 'required|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $user = $request->user();

        // One face-verification record per user — re-registering overwrites it.
        $existing = FaceVerification::where('user_id', $user->id)->first();
        if ($existing && $existing->status === 'verified') {
            return response()->json(['message' => 'Face already verified for this account.'], 400);
        }

        $idImage = $request->file('id_image');
        $livePhoto = $request->file('live_photo');

        $idImagePath = $idImage->storeAs(
            "face-verifications/{$user->id}",
            'id_' . time() . '.' . $idImage->getClientOriginalExtension(),
            'local'
        );
        $livePhotoPath = $livePhoto->storeAs(
            "face-verifications/{$user->id}",
            'live_' . time() . '.' . $livePhoto->getClientOriginalExtension(),
            'local'
        );

        $result = $this->faceService->compareImages(
            Storage::disk('local')->path($idImagePath),
            Storage::disk('local')->path($livePhotoPath)
        );

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 503);
        }

        $verification = FaceVerification::updateOrCreate(
            ['user_id' => $user->id],
            [
                'id_image_path'            => $idImagePath,
                'live_photo_path'          => $livePhotoPath,
                'face_embedding'           => $result['embedding'],
                'registration_match_score' => $result['score'],
                'status'                   => $result['match'] ? 'verified' : 'failed',
                'verified_at'              => $result['match'] ? now() : null,
            ]
        );

        \App\Models\AuditLog::record(
            'face_verification_registered',
            $verification,
            $result['match']
                ? "Face verification passed at registration for {$user->first_name} {$user->last_name}"
                : "Face verification FAILED at registration for {$user->first_name} {$user->last_name}"
        );

        if (!$result['match']) {
            return response()->json([
                'message' => 'The live photo does not match the uploaded ID. Please try again with better lighting and a clear photo of your ID.',
                'score'   => $result['score'],
            ], 422);
        }

        return response()->json([
            'message' => 'Face verified successfully.',
            'score'   => $result['score'],
        ], 201);
    }

    /**
     * Applicant checking their own verification status (e.g. Profile page).
     */
    public function show(Request $request)
    {
        $verification = FaceVerification::where('user_id', $request->user()->id)->first();

        if (!$verification) {
            return response()->json(['status' => 'not_started']);
        }

        return response()->json([
            'status'      => $verification->status,
            'verified_at' => $verification->verified_at,
        ]);
    }

    /**
     * CLAIMING DAY STEP
     * Verifier captures a fresh live photo of the applicant standing in
     * front of them, and we compare it against the embedding stored at
     * registration. Does NOT by itself mark the application as "claimed" —
     * it just tells the verifier whether the face matches, same as the
     * physical-document checks in VerifierClaiming.jsx.
     */
    public function verifyClaiming(Request $request, $applicationId)
    {
        $request->validate([
            'live_photo' => 'required|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $application = Application::with('user')->findOrFail($applicationId);

        $verification = FaceVerification::where('user_id', $application->user_id)->first();

        if (!$verification || $verification->status !== 'verified' || !$verification->face_embedding) {
            return response()->json([
                'message' => 'No face verification record found for this applicant. Fall back to manual ID check.',
            ], 404);
        }

        $livePhoto = $request->file('live_photo');
        $livePhotoPath = $livePhoto->storeAs(
            "face-verifications/{$application->user_id}",
            'claiming_' . time() . '.' . $livePhoto->getClientOriginalExtension(),
            'local'
        );

        $result = $this->faceService->compareAgainstEmbedding(
            Storage::disk('local')->path($livePhotoPath),
            $verification->face_embedding
        );

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']], 503);
        }

        $verification->update([
            'claiming_photo_path'   => $livePhotoPath,
            'claiming_match_score'  => $result['score'],
            'claiming_status'       => $result['match'] ? 'matched' : 'no_match',
            'claiming_verified_at'  => now(),
        ]);

        \App\Models\AuditLog::record(
            'face_verification_claiming',
            $verification,
            $result['match']
                ? "Face matched on claiming day for application #{$application->id}"
                : "Face did NOT match on claiming day for application #{$application->id}"
        );

        return response()->json([
            'match' => $result['match'],
            'score' => $result['score'],
        ]);
    }
}