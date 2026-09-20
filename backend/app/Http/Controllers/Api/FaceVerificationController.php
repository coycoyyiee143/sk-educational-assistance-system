<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
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
     * Applicant uploads a recent 2x2 photo + a live cam capture. We compare them,
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

        // Stamp the period active at registration time, so a freshly-
        // registered applicant isn't immediately asked to re-verify again
        // within that same period — re-verification only kicks in once a
        // *later* period opens (see reverifyStatus()).
        $activeConfig = $result['match']
            ? ApplicationConfiguration::where('is_active', true)->first()
            : null;

        $verification = FaceVerification::updateOrCreate(
            ['user_id' => $user->id],
            [
                'id_image_path'            => $idImagePath,
                'live_photo_path'          => $livePhotoPath,
                'face_embedding'           => $result['embedding'],
                'registration_match_score' => $result['score'],
                'status'                   => $result['match'] ? 'verified' : 'failed',
                'verified_at'              => $result['match'] ? now() : null,
                'verified_config_id'       => $activeConfig?->id,
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
                'message' => 'The live photo does not match your uploaded 2x2 photo. Please try again with better lighting and a clear, recent photo of yourself.',
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
     * Now also returns a photo_url so the Profile page can show the live
     * capture from registration alongside the status, without a second
     * lookup call.
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
            'photo_url'   => $verification->live_photo_path
                ? route('face-verification.my-photo')
                : null,
        ]);
    }

    /**
     * Streams the CURRENTLY AUTHENTICATED applicant's own live photo from
     * registration — for the Profile page. Deliberately scoped to
     * $request->user() only (no id/applicationId param), so an applicant
     * can never pass someone else's id and pull their photo; this route
     * only ever serves the caller's own file.
     */
    public function myPhoto(Request $request)
    {
        $verification = FaceVerification::where('user_id', $request->user()->id)->first();

        if (!$verification || !$verification->live_photo_path) {
            abort(404, 'No registration photo on file.');
        }

        if (!Storage::disk('local')->exists($verification->live_photo_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('local')->response(
            $verification->live_photo_path,
            basename($verification->live_photo_path)
        );
    }

    /**
     * Authenticated claiming-photo streaming.
     * Only the owning applicant, an sk_verifier, or an sk_admin can view —
     * same access rule as DocumentController::show(). Kept separate from
     * that method rather than folded in, since a ClaimingFaceVerification
     * row isn't an ApplicationDocument and has its own ownership path
     * (through claiming_assignment -> application), not a direct
     * application_id column.
     */
    public function showClaimingPhoto(Request $request, $id)
    {
        $faceVerification = \App\Models\ClaimingFaceVerification::with('assignment.application')->findOrFail($id);
        $application = $faceVerification->assignment->application;

        $user = $request->user();
        $isOwner    = $user->id === $application->user_id;
        $isVerifier = $user->role === 'sk_verifier';
        $isAdmin    = $user->role === 'sk_admin';

        if (!$isOwner && !$isVerifier && !$isAdmin) {
            abort(403, 'You are not authorized to view this photo.');
        }

        if (!Storage::disk('local')->exists($faceVerification->claiming_photo_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('local')->response(
            $faceVerification->claiming_photo_path,
            basename($faceVerification->claiming_photo_path)
        );
    }

    /**
     * Passive reference-photo display — the live photo captured at
     * REGISTRATION (not a claiming-day capture), shown automatically to
     * a verifier the moment they select an applicant, at zero cost — no
     * button, no capture, no wait. This is deliberately separate from
     * verifyClaiming()'s active capture-and-compare: this route only
     * displays what's already on file, it never captures or compares
     * anything new. Directly answers the panel's ask that the
     * applicant's photo be visible on the claiming page as a passive
     * human-glance reference, distinct from (and free alongside) the
     * mandatory active face check in Late Claiming.
     */
    public function registrationPhoto(Request $request, $applicationId)
    {
        $application = Application::findOrFail($applicationId);

        $user = $request->user();
        $isOwner    = $user->id === $application->user_id;
        $isVerifier = $user->role === 'sk_verifier';
        $isAdmin    = $user->role === 'sk_admin';

        if (!$isOwner && !$isVerifier && !$isAdmin) {
            abort(403, 'You are not authorized to view this photo.');
        }

        $verification = FaceVerification::where('user_id', $application->user_id)->first();

        if (!$verification || !$verification->live_photo_path) {
            abort(404, 'No registration photo on file for this applicant.');
        }

        if (!Storage::disk('local')->exists($verification->live_photo_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('local')->response(
            $verification->live_photo_path,
            basename($verification->live_photo_path)
        );
    }

    /**
     * Applicant's profile picture — the 2x2 reference photo uploaded at
     * REGISTRATION, shown as an avatar on the applicant's own topbar/profile
     * page and on verifier review screens. Unlike registrationPhoto() above
     * (which is application-scoped and shows the live selfie for face
     * comparison), this is user-scoped and shows the 2x2 photo itself.
     */
    public function profilePhoto(Request $request, $userId)
    {
        $user = $request->user();
        $isOwner    = (int) $user->id === (int) $userId;
        $isVerifier = $user->role === 'sk_verifier';
        $isAdmin    = $user->role === 'sk_admin';

        if (!$isOwner && !$isVerifier && !$isAdmin) {
            abort(403, 'You are not authorized to view this photo.');
        }

        $verification = FaceVerification::where('user_id', $userId)->first();

        if (!$verification || !$verification->id_image_path) {
            abort(404, 'No profile photo on file for this applicant.');
        }

        if (!Storage::disk('local')->exists($verification->id_image_path)) {
            abort(404, 'File not found.');
        }

        return Storage::disk('local')->response(
            $verification->id_image_path,
            basename($verification->id_image_path)
        );
    }

    public function latestClaimingVerification(Request $request, $applicationId)
    {
        $application = Application::findOrFail($applicationId);

        $assignment = \App\Models\ClaimingAssignment::where('application_id', $applicationId)
            ->with('latestFaceVerification')
            ->first();

        if (!$assignment || !$assignment->latestFaceVerification) {
            return response()->json([
                'status' => 'not_verified',
            ]);
        }

        $faceRecord = $assignment->latestFaceVerification;

        return response()->json([
            'status'    => 'verified',
            'match'     => $faceRecord->matched,
            'score'     => $faceRecord->match_score,
            'photo_url' => route('claiming.face-photo', $faceRecord->id),
        ]);
    }

    /**
     * CLAIMING DAY STEP
     * Verifier captures a fresh live photo of the applicant standing in
     * front of them, and we compare it against the embedding stored at
     * registration. This call itself does NOT mark the application as
     * "claimed" — it only records the attempt (photo, score, match result)
     * and returns the result to the verifier.
     *
     * In SCHEDULED claiming, using this is the verifier's own judgment call,
     * same as the physical-document checks — neither is backend-enforced.
     * In LATE CLAIMING, VerifierController::updateClaimStatus()
     * backend-enforces this: 'claimed' is rejected unless a passing
     * ClaimingFaceVerification row exists for that assignment, since a
     * Late Claiming walk-in has no scheduled lane/control-number structure
     * backing up identity the way scheduled claiming does.
     */
    public function verifyClaiming(Request $request, $applicationId)
    {
        $request->validate([
            'live_photo' => 'required|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $application = Application::with('user')->findOrFail($applicationId);

        $assignment = \App\Models\ClaimingAssignment::where('application_id', $applicationId)->first();
        if (!$assignment) {
            return response()->json(['message' => 'No claiming assignment found for this applicant.'], 404);
        }

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

        // Own row per attempt — never overwrites a prior attempt's proof,
        // so a sweep-driven Late Claiming retry keeps its own independent
        // record instead of silently replacing the last one.
        $faceRecord = \App\Models\ClaimingFaceVerification::create([
            'claiming_assignment_id' => $assignment->id,
            'verified_by'            => $request->user()->id,
            'claiming_photo_path'    => $livePhotoPath,
            'match_score'            => $result['score'],
            'matched'                => $result['match'],
            'verified_at'            => now(),
        ]);

        \App\Models\AuditLog::record(
            'face_verification_claiming',
            $faceRecord,
            $result['match']
                ? "Face matched on claiming day for application #{$application->id}"
                : "Face did NOT match on claiming day for application #{$application->id}"
        );

        return response()->json([
            'match'     => $result['match'],
            'score'     => $result['score'],
            'photo_url' => route('claiming.face-photo', $faceRecord->id),
        ]);
    }

    /**
     * PERIODIC RE-VERIFICATION — status check
     * Tells the Profile page whether the applicant must re-capture their
     * face before they can save profile changes: true whenever a newer
     * application period has opened since their last successful (re-)
     * verification. No active period at all means nothing to compare
     * against, so it's never required in that case.
     */
    public function reverifyStatus(Request $request)
    {
        $activeConfig = ApplicationConfiguration::where('is_active', true)->first();
        $verification = FaceVerification::where('user_id', $request->user()->id)->first();

        $required = $activeConfig
            && (!$verification || $verification->verified_config_id !== $activeConfig->id);

        return response()->json([
            'required'         => $required,
            'active_config_id' => $activeConfig?->id,
        ]);
    }

    /**
     * PERIODIC RE-VERIFICATION — re-capture
     * Same comparison as registration (fresh 2x2 vs a fresh live capture),
     * required again once a new application period opens. On a match,
     * overwrites the applicant's entire face record — old files are
     * deleted so re-verifying repeatedly doesn't pile up orphaned photos —
     * and stamps verified_config_id to the current period so this doesn't
     * get asked again until the next one opens.
     */
    public function reverify(Request $request)
    {
        $request->validate([
            'id_image'   => 'required|file|mimes:jpg,jpeg,png|max:5120',
            'live_photo' => 'required|file|mimes:jpg,jpeg,png|max:5120',
        ]);

        $activeConfig = ApplicationConfiguration::where('is_active', true)->first();
        if (!$activeConfig) {
            return response()->json(['message' => 'No active application period.'], 400);
        }

        $user = $request->user();
        $existing = FaceVerification::where('user_id', $user->id)->first();

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

        if (!$result['match']) {
            // Don't keep the failed attempt's files — nothing to overwrite
            // with since the check failed, and the applicant will retake.
            Storage::disk('local')->delete([$idImagePath, $livePhotoPath]);

            return response()->json([
                'message' => 'The live photo does not match your uploaded 2x2 photo. Please try again with better lighting and a clear, recent photo of yourself.',
                'score'   => $result['score'],
            ], 422);
        }

        $oldIdImagePath = $existing?->id_image_path;
        $oldLivePhotoPath = $existing?->live_photo_path;

        $verification = FaceVerification::updateOrCreate(
            ['user_id' => $user->id],
            [
                'id_image_path'            => $idImagePath,
                'live_photo_path'          => $livePhotoPath,
                'face_embedding'           => $result['embedding'],
                'registration_match_score' => $result['score'],
                'status'                   => 'verified',
                'verified_at'              => now(),
                'verified_config_id'       => $activeConfig->id,
            ]
        );

        foreach ([$oldIdImagePath, $oldLivePhotoPath] as $oldPath) {
            if ($oldPath && $oldPath !== $idImagePath && $oldPath !== $livePhotoPath && Storage::disk('local')->exists($oldPath)) {
                Storage::disk('local')->delete($oldPath);
            }
        }

        \App\Models\AuditLog::record(
            'face_verification_reverified',
            $verification,
            "Face re-verification passed for {$user->first_name} {$user->last_name} for application period #{$activeConfig->id}"
        );

        return response()->json([
            'message' => 'Face re-verified successfully.',
            'score'   => $result['score'],
        ]);
    }
}