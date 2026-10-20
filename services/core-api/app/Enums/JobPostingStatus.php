<?php

namespace App\Enums;

/**
 * Posting lifecycle: draft → open → closed (business-rules.md). A verified employer's submitted
 * posting opens at once; there is no admin approval step (Decision 2026-10-21).
 */
enum JobPostingStatus: string
{
    case Draft = 'draft';
    case Open = 'open';
    case Closed = 'closed';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
