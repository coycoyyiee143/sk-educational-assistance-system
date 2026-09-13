<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\SkEventController;
use App\Http\Controllers\Api\ApplicationConfigurationController;
use App\Http\Controllers\Api\AdminScheduleController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminReportController;
use App\Http\Controllers\Api\VerifierController;
use App\Http\Controllers\Api\FaceVerificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PersonnelSetupController;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/register/check', [AuthController::class, 'checkDuplicate']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1'); // 10 attempts per minute per IP
Route::post('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->name('verification.verify');
Route::post('/email/resend', [AuthController::class, 'resendVerification']);
Route::post('/email/verify-by-code', [AuthController::class, 'verifyEmailByCode']);

// 2FA — called right after /login returns a "2fa_required" response,
// using a short-lived pending token instead of a session (stateless API).
// Both handled inside AuthController — no separate TwoFactorController.
Route::post('/2fa/setup/confirm', [AuthController::class, 'confirmTwoFactorSetup']); // activates + logs in
Route::post('/2fa/verify', [AuthController::class, 'verifyTwoFactor']);              // normal login 2FA step

// Forgot Password
Route::post('/password/forgot', [PasswordResetController::class, 'sendResetCode']);
Route::post('/password/verify-code', [PasswordResetController::class, 'verifyResetCode']);
Route::post('/password/reset', [PasswordResetController::class, 'resetPassword']);

// Personnel account setup / admin-initiated reset — public, since the
// person clicking this link from their email isn't logged in yet.
Route::get('/personnel/setup/{token}', [PersonnelSetupController::class, 'show']);
Route::post('/personnel/setup/{token}', [PersonnelSetupController::class, 'store']);

// Public info routes
Route::get('/announcements', [AnnouncementController::class, 'index']);
Route::get('/announcements/{id}', [AnnouncementController::class, 'show']);
Route::get('/events', [SkEventController::class, 'index']);
Route::get('/events/{id}', [SkEventController::class, 'show']);
Route::get('/application-config/active', [ApplicationConfigurationController::class, 'active']);

// Authenticated routes
// SECURITY FIX: Previously these routes only required authentication
// (any logged-in user, regardless of role, could call them). Now
// wrapped in role:sk_admin so only users with role = 'sk_admin' can
// access admin endpoints (user management, app config, schedules,
// announcements, events, reports).

Route::middleware(['auth:sanctum'])->group(function () {
    // ── Admin routes ────────────────────────────────────────────────
    Route::middleware(['role:sk_admin'])->group(function () {
        Route::get('/admin/stats', [AdminController::class, 'stats']);
        Route::get('/admin/users', [AdminController::class, 'users']);
        Route::post('/admin/users/personnel', [AdminController::class, 'createPersonnel']);
        Route::put('/admin/users/{id}', [AdminController::class, 'updateUser']);
        Route::patch('/admin/users/{id}/toggle-status', [AdminController::class, 'toggleStatus']);
        Route::delete('/admin/users/{id}', [AdminController::class, 'deleteUser']);
        Route::post('/admin/users/{id}/reset-password', [AdminController::class, 'resetPassword']);
        // Works for personnel AND applicant accounts — see resetTwoFactor()
        // docblock in AdminController for why this is admin-only and not
        // self-service.
        Route::post('/admin/users/{id}/reset-2fa', [AdminController::class, 'resetTwoFactor']);
        Route::get('/admin/application-configs', [ApplicationConfigurationController::class, 'index']);
        Route::put('/admin/application-configs/{id}', [ApplicationConfigurationController::class, 'update']);
        // The ONLY way to change close_date — separate from update()
        // above, its own auditable action (see ApplicationConfigurationController::extend()).
        Route::post('/admin/application-configs/{id}/extend', [ApplicationConfigurationController::class, 'extend']);
        Route::post('/admin/application-configs/{id}/close', [AdminScheduleController::class, 'closePeriod']);
        Route::get('/admin/claiming-schedule', [AdminScheduleController::class, 'show']);
        Route::post('/admin/claiming-schedule', [AdminScheduleController::class, 'store']);
        Route::get('/admin/claiming-schedule/lane-assignments', [AdminScheduleController::class, 'laneAssignments']);
        // CHANGED: publish()/preview() removed — real-time assignment
        // (ClaimingAssignmentService) means there's nothing left to
        // preview or bulk-publish. activate() turns a schedule on and
        // runs a one-time catch-up pass for anyone already approved.
        Route::post('/admin/claiming-schedule/{id}/activate', [AdminScheduleController::class, 'activate']);
        Route::post('/admin/claiming-schedule/lanes/{laneId}/assign-verifier', [AdminScheduleController::class, 'assignVerifier']);
        Route::get('/admin/claiming-schedule/lanes/{laneId}/printable', [AdminScheduleController::class, 'printableLane']);
        Route::get('/admin/claiming-schedule/lanes/{laneId}/printable/pdf', [AdminScheduleController::class, 'printableLanePdf']);
        Route::post('/application-config', [ApplicationConfigurationController::class, 'store']);
        Route::get('/admin/announcements', [AnnouncementController::class, 'adminIndex']);
        Route::post('/admin/announcements', [AnnouncementController::class, 'store']);
        Route::put('/admin/announcements/{id}', [AnnouncementController::class, 'update']);
        Route::delete('/admin/announcements/{id}', [AnnouncementController::class, 'destroy']);
        Route::get('/admin/events', [SkEventController::class, 'adminIndex']);
        Route::post('/admin/events', [SkEventController::class, 'store']);
        Route::put('/admin/events/{id}', [SkEventController::class, 'update']); // POST + _method=PUT for multipart // PUT - JAS
        Route::delete('/admin/events/{id}', [SkEventController::class, 'destroy']);
        Route::get('/admin/reports/summary', [AdminReportController::class, 'summary']);
        Route::get('/admin/reports/applications', [AdminReportController::class, 'applications']);
        Route::get('/admin/reports/export', [AdminReportController::class, 'export']);
        Route::get('/admin/reports/claiming-outcomes', [AdminReportController::class, 'claimingOutcomeSummary']);
        Route::get('/admin/reports/document-failures', [AdminReportController::class, 'documentFailureBreakdown']);
        Route::get('/admin/reports/applicant-distribution', [AdminReportController::class, 'applicantDistribution']);
        Route::get('/admin/reports/submission-trends', [AdminReportController::class, 'submissionTrends']);
        Route::get('/admin/reports/age-distribution', [AdminReportController::class, 'ageDistribution']);
        Route::get('/admin/reports/periods', [AdminReportController::class, 'listPeriods']);
        Route::get('/admin/reports/filter-options', [AdminReportController::class, 'filterOptions']);
        Route::get('/admin/reports/age-distribution/pdf', [AdminReportController::class, 'ageDistributionPdf']);
        Route::get('/admin/reports/submission-vs-approval', [AdminReportController::class, 'submissionVsApprovalTrend']);
        Route::get('/admin/reports/claiming-outcomes/pdf', [AdminReportController::class, 'claimingOutcomesPdf']);
        Route::get('/admin/reports/document-failures/pdf', [AdminReportController::class, 'documentFailuresPdf']);
        Route::get('/admin/reports/applicant-distribution/pdf', [AdminReportController::class, 'applicantDistributionPdf']);
        Route::get('/admin/reports/school-program/pdf', [AdminReportController::class, 'schoolProgramPdf']);
        Route::get('/admin/reports/year-level-age/pdf', [AdminReportController::class, 'yearLevelAgePdf']);
        Route::get('/admin/reports/submission-trends/pdf', [AdminReportController::class, 'submissionTrendsPdf']);
        Route::get('/admin/reports/submission-vs-approval/pdf', [AdminReportController::class, 'submissionVsApprovalPdf']);
        Route::get('/admin/reports/grace-period-claiming-list/pdf', [AdminReportController::class, 'gracePeriodClaimingListPdf']);
        Route::get('/admin/reports/approved-applicants/pdf', [AdminReportController::class, 'approvedApplicantsPdf']);
        Route::get('/admin/reports/approved-applicants/html', [AdminReportController::class, 'approvedApplicantsHtml']);
        Route::get('/admin/reports/grace-period-claiming-list', [AdminReportController::class, 'gracePeriodClaimingList']);
        Route::get('/admin/reports/disbursement', [AdminReportController::class, 'disbursementReport']);
        Route::get('/admin/reports/disbursement/pdf', [AdminReportController::class, 'disbursementReportPdf']);
        Route::get('/admin/reports/budget-estimation', [AdminReportController::class, 'budgetEstimation']);
        Route::get('/admin/reports/budget-forecast', [AdminReportController::class, 'budgetForecast']);
        Route::get('/admin/reports/unmet-demand', [AdminReportController::class, 'unmetDemand']);
        Route::get('/admin/reports/last-cycle-actuals', [AdminReportController::class, 'lastCycleActuals']);
        Route::get('/admin/reports/ocr-queue-health', [AdminReportController::class, 'ocrQueueHealth']);
        Route::get('/admin/activity-log', [AdminController::class, 'activityLog']);
        Route::get('/admin/master-activity-log', [AdminController::class, 'masterActivityLog']);

    });

    Route::middleware(['auth:sanctum', 'log.visit'])->group(function () {
        // ── Admin routes ────────────────────────────────────────────────
        Route::middleware(['role:sk_admin'])->group(function () {
        });

        // ── Verifier routes ─────────────────────────────────────────────
        Route::middleware(['role:sk_verifier'])->group(function () {
        });

        // ── Applicant routes ────────────────────────────────────────────
        Route::middleware(['role:applicant'])->group(function () {
        });

    });

    // ── Verifier routes ─────────────────────────────────────────────
    Route::middleware(['role:sk_verifier'])->group(function () {
        Route::get('/verifier/applications', [VerifierController::class, 'index']);
        Route::get('/verifier/applications/{id}', [VerifierController::class, 'show']);
        Route::post('/verifier/applications/{id}/approve', [VerifierController::class, 'approve']);
        Route::post('/verifier/applications/{id}/reject', [VerifierController::class, 'reject']);
        Route::post('/verifier/applications/{id}/reupload', [VerifierController::class, 'requestReupload']);
        Route::get('/verifier/stats', [VerifierController::class, 'stats']);
        Route::post('/verifier/documents/{document}/retry-ocr', [VerifierController::class, 'retryOcr']);
        Route::get('/verifier/claiming/search', [VerifierController::class, 'searchClaiming']);
        Route::get('/verifier/claiming/lanes', [VerifierController::class, 'claimingLanes']);
        Route::post('/verifier/claiming/lanes/{laneId}/self-assign', [VerifierController::class, 'selfAssignLane']);
        Route::post('/verifier/claiming/{id}/status', [VerifierController::class, 'updateClaimStatus']);
        Route::post('/verifier/applications/config/{configId}/promote-waitlist', [VerifierController::class, 'promoteFromWaitlist']);
        Route::post('/verifier/applications/config/{configId}/promote-all-waitlist', [VerifierController::class, 'promoteAllFromWaitlist']);
        Route::get('/verifier/waitlist', [VerifierController::class, 'waitlist']);
        Route::get('/verifier/activity-log', [VerifierController::class, 'activityLog']);
        Route::get('/verifier/claiming/{applicationId}/face-verification', [FaceVerificationController::class, 'latestClaimingVerification']);
        Route::post('/verifier/claiming/{applicationId}/verify-face', [FaceVerificationController::class, 'verifyClaiming']);
    });

    // ── Applicant routes ────────────────────────────────────────────
    Route::middleware(['role:applicant'])->group(function () {
        Route::get('/applications', [ApplicationController::class, 'index']);
        Route::get('/applications/claiming-schedule', [ApplicationController::class, 'claimingSchedule']); // Placed above {id}
        Route::get('/applications/activity-log', [ApplicationController::class, 'activityLog']);
        Route::post('/applications', [ApplicationController::class, 'store']);
        Route::get('/applications/{id}', [ApplicationController::class, 'show']);
        Route::put('/applications/{id}', [ApplicationController::class, 'update']);
        Route::post('/applications/{id}/documents', [DocumentController::class, 'upload']);
        Route::post('/applications/{id}/documents/{docId}/reupload', [DocumentController::class, 'reupload']);
        Route::get('/applications/{id}/documents', [DocumentController::class, 'index']);
        Route::post('/face-verification', [FaceVerificationController::class, 'store']);
        Route::get('/face-verification', [FaceVerificationController::class, 'show']);
        Route::get('/face-verification/photo', [FaceVerificationController::class, 'myPhoto'])
            ->name('face-verification.my-photo');

    });

    // ── Shared routes (any authenticated role) ─────────────────────
    Route::put('/user/profile', [ProfileController::class, 'updateAccount']);
    Route::put('/user/password', [ProfileController::class, 'updatePassword']);
    Route::get('/applications/{id}/documents/{docId}/file', [DocumentController::class, 'show']);
    Route::get('/claiming/face-verifications/{id}/photo', [FaceVerificationController::class, 'showClaimingPhoto'])->name('claiming.face-photo');
    Route::get('/claiming/applications/{applicationId}/registration-photo', [FaceVerificationController::class, 'registrationPhoto']);

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::post('/profile', [ProfileController::class, 'store']);
    Route::put('/profile', [ProfileController::class, 'update']);
});