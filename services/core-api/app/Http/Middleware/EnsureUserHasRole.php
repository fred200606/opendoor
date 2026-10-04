<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Usage: ->middleware('role:employer') or 'role:employer,admin'. Runs after auth:sanctum.
 */
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $allowed = array_map(fn (string $role) => UserRole::from($role), $roles);

        if (! $request->user()?->hasRole(...$allowed)) {
            throw new ApiException('FORBIDDEN', 'This action is unauthorized.', 403);
        }

        return $next($request);
    }
}
