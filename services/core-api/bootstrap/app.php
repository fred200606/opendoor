<?php

use App\Exceptions\ApiErrorRenderer;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\EnsureAccountActive;
use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->prepend(AssignRequestId::class);
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'active' => EnsureAccountActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => ApiErrorRenderer::appliesTo($request));
        $exceptions->render(fn (Throwable $e, Request $request) => (new ApiErrorRenderer)($e, $request));
    })->create();
