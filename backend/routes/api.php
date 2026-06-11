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

});