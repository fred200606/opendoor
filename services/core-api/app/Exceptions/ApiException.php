<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Business-rule error rendered as the OpenDoor error envelope.
 *
 * Example: throw new ApiException('ALREADY_APPLIED', 'You have already applied to this posting.', 409);
 */
class ApiException extends RuntimeException
{
    /**
     * @param  array<string, string>  $headers
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 400,
        public readonly array $headers = [],
    ) {
        parent::__construct($message);
    }
}
