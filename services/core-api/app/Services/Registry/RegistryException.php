<?php

namespace App\Services\Registry;

use App\Exceptions\ApiException;

/**
 * A registry call that did not produce a result, already mapped to the API error (SIA 4.3):
 * Client.Authentication → 502 REGISTRY_AUTH_FAILED, Client.Validation → 422
 * REGISTRY_INVALID_REQUEST, Server fault / connection error / timeout → 502 REGISTRY_UNAVAILABLE.
 */
class RegistryException extends ApiException
{
    public function __construct(string $errorCode, string $message, int $status, public readonly ?string $rawResponse = null)
    {
        parent::__construct($errorCode, $message, $status);
    }

    public static function unavailable(?string $rawResponse = null): self
    {
        return new self('REGISTRY_UNAVAILABLE', 'The business registry is not responding. Try again later or verify the employer manually.', 502, $rawResponse);
    }

    public static function authFailed(?string $rawResponse = null): self
    {
        return new self('REGISTRY_AUTH_FAILED', 'OpenDoor could not sign in to the business registry.', 502, $rawResponse);
    }

    public static function invalidRequest(string $reason, ?string $rawResponse = null): self
    {
        return new self('REGISTRY_INVALID_REQUEST', "The business registry rejected the registration details: {$reason}", 422, $rawResponse);
    }

    /** Only "unavailable" is stored as an ERROR check; the other two are request or configuration problems. */
    public function isUnavailable(): bool
    {
        return $this->errorCode === 'REGISTRY_UNAVAILABLE';
    }
}
