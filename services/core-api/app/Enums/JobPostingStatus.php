<?php

namespace App\Enums;

/** Posting lifecycle: draft → pending_approval → open → closed (business-rules.md). */
enum JobPostingStatus: string
{
    case Draft = 'draft';
    case PendingApproval = 'pending_approval';
    case Open = 'open';
    case Closed = 'closed';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
