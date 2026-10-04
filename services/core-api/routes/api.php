<?php

use App\Http\Controllers\AccommodationController;
use App\Http\Controllers\Admin;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\MeController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\Employer\CompanyController;
use App\Http\Controllers\EmployerController;
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

// Any logged-in, non-suspended user
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [MeController::class, 'show']);
    Route::put('me/password', [MeController::class, 'updatePassword']);

    // Employer
    Route::middleware('role:employer')->prefix('employer')->group(function () {
        Route::get('company', [CompanyController::class, 'show']);
        Route::put('company', [CompanyController::class, 'update']);
    });

    // Admin
    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::apiResource('categories', Admin\CategoryController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('accommodations', Admin\AccommodationController::class)->only(['index', 'store', 'update', 'destroy']);
    });
});
