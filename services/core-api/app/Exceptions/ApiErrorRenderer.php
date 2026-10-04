<?php

namespace App\Exceptions;

use App\Http\Middleware\AssignRequestId;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Turns every exception on an API route into the OpenDoor error envelope
 * (see docs/openapi.yaml → Error / ValidationError). Never exposes stack traces.
 */
class ApiErrorRenderer
{
    /** HTTP status → [error code, default message] for framework exceptions. */
    private const DEFAULTS = [
        400 => ['BAD_REQUEST', 'The request could not be processed.'],
        401 => ['UNAUTHENTICATED', 'Unauthenticated.'],
        403 => ['FORBIDDEN', 'This action is unauthorized.'],
        404 => ['NOT_FOUND', 'The requested resource was not found.'],
        429 => ['RATE_LIMITED', 'Too many requests. Please try again later.'],
        500 => ['SERVER_ERROR', 'Something went wrong. Please try again later.'],
    ];

    public static function appliesTo(Request $request): bool
    {
        return $request->is('api/*', 'internal/*') || $request->expectsJson();
    }

    public function __invoke(Throwable $e, Request $request): ?JsonResponse
    {
        if (! self::appliesTo($request)) {
            return null;
        }

        $requestId = AssignRequestId::idFor($request);

        if ($e instanceof ValidationException) {
            return $this->respond([
                'message' => 'The given data was invalid.',
                'error' => ['code' => 'VALIDATION_FAILED', 'request_id' => $requestId],
                'errors' => $e->errors(),
            ], 422, [], $requestId);
        }

        if ($e instanceof ApiException) {
            return $this->envelope($e->errorCode, $e->getMessage(), $e->status, $e->headers, $requestId);
        }

        if ($e instanceof AuthenticationException) {
            return $this->fromDefaults(401, $requestId);
        }

        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
            [$code, $message] = self::DEFAULTS[$status] ?? self::DEFAULTS[$status >= 500 ? 500 : 400];

            // Keep explicit messages from abort(400|403, '...'); hide route/model details on 404 and 5xx.
            if (in_array($status, [400, 403], true) && $e->getMessage() !== '') {
                $message = $e->getMessage();
            }

            return $this->envelope($code, $message, $status, $e->getHeaders(), $requestId);
        }

        return $this->fromDefaults(500, $requestId);
    }

    private function fromDefaults(int $status, string $requestId): JsonResponse
    {
        [$code, $message] = self::DEFAULTS[$status];

        return $this->envelope($code, $message, $status, [], $requestId);
    }

    /**
     * @param  array<string, string>  $headers
     */
    private function envelope(string $code, string $message, int $status, array $headers, string $requestId): JsonResponse
    {
        return $this->respond(
            ['error' => ['code' => $code, 'message' => $message, 'request_id' => $requestId]],
            $status,
            $headers,
            $requestId,
        );
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, string>  $headers
     */
    private function respond(array $body, int $status, array $headers, string $requestId): JsonResponse
    {
        return response()->json($body, $status, [...$headers, AssignRequestId::HEADER => $requestId]);
    }
}
