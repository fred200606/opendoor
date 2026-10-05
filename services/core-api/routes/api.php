<?php

use App\Http\Controllers\AccommodationController;
use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Candidate\ProfileController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\Employer\CompanyController;
use App\Http\Controllers\Employer\PostingController;
use App\Http\Controllers\EmployerController;
use App\Http\Controllers\JobPostingController;
use App\Http\Controllers\JobSearchController;
use App\Http\Controllers\ResumeController;
use Illuminate\Support\Facades\Route;

// M1 Auth – public
Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

// M11 Master data – public filter options
Route::get('categories', [CategoryController::class, 'index']);
Route::get('accommodations', [AccommodationController::class, 'index']);

// M3 Company – public employer page and logo
Route::get('employers/{employer}', [EmployerController::class, 'show']);
Route::get('employers/{employer}/logo', [EmployerController::class, 'logo']);

// M5 Search – public; candidates with saved needs also get `match` (token optional)
Route::get('job-postings', [JobSearchController::class, 'index']);

// M4 Job postings – details are public for open postings (owners and admins also see drafts)
Route::get('job-postings/{jobPosting}', [JobPostingController::class, 'show']);

// M2 Résumé – temporary signed link (relative signature: valid through the gateway)
Route::get('resumes/{candidateProfile}', [ResumeController::class, 'show'])->middleware('signed:relative')->name('resumes.show');

// Any logged-in, non-suspended user
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [MeController::class, 'show']);
    Route::put('me/password', [MeController::class, 'updatePassword']);

    // Candidate
    Route::middleware('role:candidate')->prefix('candidate')->group(function () {
        Route::get('profile', [ProfileController::class, 'show']);
        Route::put('profile', [ProfileController::class, 'update']);
        Route::put('accommodations', [ProfileController::class, 'updateNeeds']);
        Route::post('resume', [ProfileController::class, 'uploadResume']);
    });

    // Employer
    Route::middleware('role:employer')->prefix('employer')->group(function () {
        Route::get('company', [CompanyController::class, 'show']);
        Route::put('company', [CompanyController::class, 'update']);
        Route::get('job-postings', [PostingController::class, 'index']);
    });

    // M4 Job postings – an employer manages only its own (JobPostingPolicy)
    Route::middleware('role:employer')->group(function () {
        Route::post('job-postings', [JobPostingController::class, 'store']);
        Route::put('job-postings/{jobPosting}', [JobPostingController::class, 'update']);
        Route::delete('job-postings/{jobPosting}', [JobPostingController::class, 'destroy']);
        Route::patch('job-postings/{jobPosting}/status', [JobPostingController::class, 'updateStatus']);
    });

    // Admin
    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::apiResource('categories', Admin\CategoryController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('accommodations', Admin\AccommodationController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::get('job-postings', [Admin\PostingApprovalController::class, 'index'])->name('job-postings.index');
        Route::patch('job-postings/{jobPosting}/approve', [Admin\PostingApprovalController::class, 'review'])->name('job-postings.review');
    });
});
