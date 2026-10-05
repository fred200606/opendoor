<?php

namespace App\Services\Registry;

use App\Enums\RegistryStatus;
use Carbon\CarbonImmutable;

/** The registry's VerifyBusinessRegistrationResponse, mapped from XML. */
final readonly class RegistryResult
{
    public function __construct(
        public RegistryStatus $status,
        public ?string $registeredName,
        public ?float $nameMatch,
        public CarbonImmutable $checkedAt,
        public ?string $rawResponse = null,
    ) {}
}
