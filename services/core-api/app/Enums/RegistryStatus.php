<?php

namespace App\Enums;

/** Result of a Business Registry check; ERROR = the registry could not answer (stored for the audit trail). */
enum RegistryStatus: string
{
    case Active = 'ACTIVE';
    case Expired = 'EXPIRED';
    case Cancelled = 'CANCELLED';
    case NotFound = 'NOT_FOUND';
    case Error = 'ERROR';
}
