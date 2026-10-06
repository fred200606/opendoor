<?php

namespace App\Http\Middleware;

use App\Exceptions\ApiException;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards /internal/* (service-to-service, never routed by the gateway): the X-Service-Key header
 * must equal SERVICE_KEY_INSIGHTS, compared in constant time. An unset key refuses every call.
 */
class EnsureServiceKey
{
    public const HEADER = 'X-Service-Key';

    public function handle(Request $request, Closure $next): Response
    {
        $expected = (string) config('services.insights.key');
        $given = $request->header(self::HEADER);

        if ($expected === '' || ! is_string($given) || ! hash_equals($expected, $given)) {
            throw new ApiException('UNAUTHENTICATED', 'A valid service key is required.', 401);
        }

        return $next($request);
    }
}
