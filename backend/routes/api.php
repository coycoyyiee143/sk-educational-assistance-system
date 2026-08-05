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

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->name('verification.verify');
Route::post('/email/resend', [AuthController::class, 'resendVerification']);
Route::post('/email/verify-by-code', [AuthController::class, 'verifyEmailByCode']);

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
        Route::get('/admin/application-configs', [ApplicationConfigurationController::class, 'index']);
        Route::put('/admin/application-configs/{id}', [ApplicationConfigurationController::class, 'update']);
        Route::get('/admin/claiming-schedule', [AdminScheduleController::class, 'show']);
        Route::post('/admin/claiming-schedule', [AdminScheduleController::class, 'store']);
        Route::post('/admin/claiming-schedule/{id}/publish', [AdminScheduleController::class, 'publish']);
        Route::get('/admin/claiming-schedule/{id}/preview', [AdminScheduleController::class, 'preview']);
        Route::get('/admin/claiming-schedule/lanes/{laneId}/printable', [AdminScheduleController::class, 'printableLane']);
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
        Route::get('/admin/reports/submission-trends/pdf', [AdminReportController::class, 'submissionTrendsPdf']);
        Route::get('/admin/reports/submission-vs-approval/pdf', [AdminReportController::class, 'submissionVsApprovalPdf']);
        Route::get('/admin/reports/budget-estimation', [AdminReportController::class, 'budgetEstimation']);
        Route::get('/admin/reports/budget-forecast', [AdminReportController::class, 'budgetForecast']);
        Route::get('/admin/reports/last-cycle-actuals', [AdminReportController::class, 'lastCycleActuals']);
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
        Route::get('/verifier/claiming/search', [VerifierController::class, 'searchClaiming']);
        Route::post('/verifier/claiming/{id}/status', [VerifierController::class, 'updateClaimStatus']);
        Route::get('/verifier/activity-log', [VerifierController::class, 'activityLog']);
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
       
    });

    // ── Shared routes (any authenticated role) ─────────────────────
    Route::put('/user/profile', [ProfileController::class, 'updateAccount']);
    Route::put('/user/password', [ProfileController::class, 'updatePassword']);
    Route::get('/applications/{id}/documents/{docId}/file', [DocumentController::class, 'show']);

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::post('/profile', [ProfileController::class, 'store']);
    Route::put('/profile', [ProfileController::class, 'update']);
});