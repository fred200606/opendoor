<?php

use App\Http\Controllers\Internal\PostingSummaryController;
use Illuminate\Support\Facades\Route;

/*
 * Service-to-service routes (prefix /internal, `service.key` middleware, no Sanctum).
 * The gateway never routes /internal/*; only the Insights Service calls these on the private network.
 */

Route::get('/job-postings/{id}/summary', PostingSummaryController::class)->whereNumber('id');
