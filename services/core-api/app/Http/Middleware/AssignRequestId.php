<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Reuses the gateway's X-Request-ID (or creates one), adds it to every log line
 * and echoes it back in the response header.
 */
class AssignRequestId
{
    public const HEADER = 'X-Request-ID';

    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->headers->get(self::HEADER);
        $requestId = is_string($incoming) && Str::isUuid($incoming) ? $incoming : (string) Str::uuid();

        $request->attributes->set('request_id', $requestId);
        $request->headers->set(self::HEADER, $requestId);
        Log::shareContext(['request_id' => $requestId]);

        $response = $next($request);
        $response->headers->set(self::HEADER, $requestId);

        return $response;
    }

    public static function idFor(Request $request): string
    {
        $requestId = $request->attributes->get('request_id');

        if (! is_string($requestId)) {
            // Error raised before the middleware ran; still give the client a reference.
            $requestId = (string) Str::uuid();
            $request->attributes->set('request_id', $requestId);
        }

        return $requestId;
    }
}
