<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\MeController;
use Illuminate\Support\Facades\Route;

// M1 Auth – public
Route::post('register', [AuthController::class, 'register']);
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');

// Any logged-in, non-suspended user
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [MeController::class, 'show']);
    Route::put('me/password', [MeController::class, 'updatePassword']);
});
