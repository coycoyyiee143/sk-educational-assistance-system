<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ApplicationController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\AnnouncementController;
use App\Http\Controllers\Api\SkEventController;
use App\Http\Controllers\Api\ApplicationConfigurationController;

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->name('verification.verify');
Route::post('/email/resend', [AuthController::class, 'resendVerification']);

// Public info routes
Route::get('/announcements', [AnnouncementController::class, 'index']);
Route::get('/announcements/{id}', [AnnouncementController::class, 'show']);
Route::get('/events', [SkEventController::class, 'index']);
Route::get('/events/{id}', [SkEventController::class, 'show']);
Route::get('/application-config/active', [ApplicationConfigurationController::class, 'active']);

// Authenticated routes
Route::middleware(['auth:sanctum'])->group(function () {

    // Admin routes
    Route::get('/admin/stats', [App\Http\Controllers\Api\AdminController::class, 'stats']);
    Route::get('/admin/users', [App\Http\Controllers\Api\AdminController::class, 'users']);
    Route::post('/admin/users/personnel', [App\Http\Controllers\Api\AdminController::class, 'createPersonnel']);
    Route::put('/admin/users/{id}', [App\Http\Controllers\Api\AdminController::class, 'updateUser']);
    Route::patch('/admin/users/{id}/toggle-status', [App\Http\Controllers\Api\AdminController::class, 'toggleStatus']);
    Route::delete('/admin/users/{id}', [App\Http\Controllers\Api\AdminController::class, 'deleteUser']);
    Route::get('/admin/application-configs', [ApplicationConfigurationController::class, 'index']);
    Route::put('/admin/application-configs/{id}', [ApplicationConfigurationController::class, 'update']);

    // Verifier routes
    Route::get('/verifier/applications', [App\Http\Controllers\Api\VerifierController::class, 'index']);
    Route::get('/verifier/applications/{id}', [App\Http\Controllers\Api\VerifierController::class, 'show']);
    Route::post('/verifier/applications/{id}/approve', [App\Http\Controllers\Api\VerifierController::class, 'approve']);
    Route::post('/verifier/applications/{id}/reject', [App\Http\Controllers\Api\VerifierController::class, 'reject']);
    Route::post('/verifier/applications/{id}/reupload', [App\Http\Controllers\Api\VerifierController::class, 'requestReupload']);
    Route::get('/verifier/stats', [App\Http\Controllers\Api\VerifierController::class, 'stats']);

    // Shared profile update
    Route::put('/user/profile', [App\Http\Controllers\Api\ProfileController::class, 'updateAccount']);
    Route::put('/user/password', [App\Http\Controllers\Api\ProfileController::class, 'updatePassword']);

    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    // Profile
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::post('/profile', [ProfileController::class, 'store']);
    Route::put('/profile', [ProfileController::class, 'update']);

    // Applications
    Route::get('/applications', [ApplicationController::class, 'index']);
    Route::post('/applications', [ApplicationController::class, 'store']);
    Route::get('/applications/{id}', [ApplicationController::class, 'show']);

    // Documents
    Route::post('/applications/{id}/documents', [DocumentController::class, 'upload']);
    Route::post('/applications/{id}/documents/{docId}/reupload', [DocumentController::class, 'reupload']);
    Route::get('/applications/{id}/documents', [DocumentController::class, 'index']);

    // Admin - Application Configuration (basic, full admin panel is Sprint 4)
    Route::post('/application-config', [ApplicationConfigurationController::class, 'store']);
});