<?php

use App\Http\Controllers\AccommodationController;
use App\Http\Controllers\Admin;
use App\Http\Controllers\ApplicationController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\Candidate\ProfileController;
use App\Http\Controllers\Candidate\SavedJobController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\Employer\CompanyController;
use App\Http\Controllers\Employer\PostingController;
use App\Http\Controllers\EmployerController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\JobPostingController;
use App\Http\Controllers\JobSearchController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\ReportController;
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

// M7 Trust score – public; published only from 3 responses
Route::get('employers/{employer}/trust-score', [EmployerController::class, 'trustScore']);

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
    Route::put('me/display-prefs', [MeController::class, 'updateDisplayPrefs']); // M13
    Route::put('me/email-notifications', [MeController::class, 'updateEmailNotifications'])->middleware('role:candidate,employer'); // M13

    // M9 Notifications – own in-app notices (admins receive none)
    Route::middleware('role:candidate,employer')->prefix('notifications')->group(function () {
        Route::get('/', [NotificationController::class, 'index']);
        Route::patch('read-all', [NotificationController::class, 'readAll']);
        Route::patch('{id}/read', [NotificationController::class, 'read']);
    });

    // Candidate
    Route::middleware('role:candidate')->prefix('candidate')->group(function () {
        Route::get('profile', [ProfileController::class, 'show']);
        Route::put('profile', [ProfileController::class, 'update']);
        Route::put('accommodations', [ProfileController::class, 'updateNeeds']);
        Route::post('resume', [ProfileController::class, 'uploadResume']);
        Route::get('dashboard', [DashboardController::class, 'candidate']);
        // M12 Saved jobs – own bookmarks of visible postings
        Route::get('saved-jobs', [SavedJobController::class, 'index']);
        Route::post('saved-jobs/{jobPosting}', [SavedJobController::class, 'store']);
        Route::delete('saved-jobs/{jobPosting}', [SavedJobController::class, 'destroy'])->whereNumber('jobPosting');
    });

    // M6 Applications – the candidate applies; both parties follow the status workflow (ApplicationPolicy)
    Route::post('job-postings/{jobPosting}/applications', [ApplicationController::class, 'store'])->middleware('role:candidate');
    Route::middleware('role:candidate,employer')->group(function () {
        Route::get('applications', [ApplicationController::class, 'index']);
        Route::get('applications/{application}', [ApplicationController::class, 'show']);
        Route::patch('applications/{application}/status', [ApplicationController::class, 'updateStatus']);
    });

    // M10 Reports – a candidate reports a visible posting
    Route::post('job-postings/{jobPosting}/reports', [ReportController::class, 'store'])->middleware('role:candidate');

    // M7 Feedback – only the hired candidate (ApplicationPolicy::giveFeedback)
    Route::middleware('role:candidate')->group(function () {
        Route::get('applications/{application}/feedback-form', [FeedbackController::class, 'form']);
        Route::post('applications/{application}/feedback', [FeedbackController::class, 'store']);
    });

    // Employer
    Route::middleware('role:employer')->prefix('employer')->group(function () {
        Route::get('company', [CompanyController::class, 'show']);
        Route::put('company', [CompanyController::class, 'update']);
        Route::get('job-postings', [PostingController::class, 'index']);
        Route::get('dashboard', [DashboardController::class, 'employer']);
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
        Route::get('dashboard', [DashboardController::class, 'admin'])->name('dashboard');
        Route::apiResource('categories', Admin\CategoryController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('accommodations', Admin\AccommodationController::class)->only(['index', 'store', 'update', 'destroy']);
        Route::get('job-postings', [Admin\PostingApprovalController::class, 'index'])->name('job-postings.index');
        Route::patch('job-postings/{jobPosting}/approve', [Admin\PostingApprovalController::class, 'review'])->name('job-postings.review');
        Route::delete('job-postings/{jobPosting}', [Admin\PostingApprovalController::class, 'destroy'])->name('job-postings.destroy');
        // M3 verification: SOAP registry check + the admin's decision (Phase 6)
        Route::get('employers', [Admin\EmployerVerificationController::class, 'index'])->name('employers.index');
        Route::get('employers/{employer}', [Admin\EmployerVerificationController::class, 'show'])->name('employers.show');
        Route::patch('employers/{employer}/verify', [Admin\EmployerVerificationController::class, 'verify'])->name('employers.verify');
        // M10 moderation: accounts, reported postings, feedback responses
        Route::get('users', [Admin\UserController::class, 'index'])->name('users.index');
        Route::patch('users/{user}/suspend', [Admin\UserController::class, 'suspend'])->name('users.suspend');
        Route::get('reports', [Admin\ReportController::class, 'index'])->name('reports.index');
        Route::get('reports/{report}', [Admin\ReportController::class, 'show'])->name('reports.show');
        Route::patch('reports/{report}', [Admin\ReportController::class, 'update'])->name('reports.update');
        Route::get('feedback', [Admin\FeedbackModerationController::class, 'index'])->name('feedback.index');
        Route::patch('feedback/{feedback}/hide', [Admin\FeedbackModerationController::class, 'hide'])->name('feedback.hide');
    });
});
