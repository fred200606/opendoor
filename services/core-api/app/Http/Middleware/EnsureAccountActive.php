<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks suspended accounts even if a token survived (suspension also revokes tokens).
 */
class EnsureAccountActive
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() && ! $request->user()->is_active) {
            throw new ApiException('ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact the OpenDoor administrator.', 403);
        }

        return $next($request);
    }
}
