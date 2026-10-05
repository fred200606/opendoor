<?php

namespace App\Enums;

/**
 * Application workflow (business-rules.md). Status never moves backward; hired, rejected and
 * withdrawn are final.
 *
 *   pending → reviewed               employer (automatically when the employer opens it)
 *   pending | reviewed → withdrawn   candidate
 *   reviewed → rejected              employer
 *   reviewed → hired                 employer or candidate ("I was hired")
 */
enum ApplicationStatus: string
{
    case Pending = 'pending';
    case Reviewed = 'reviewed';
    case Hired = 'hired';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';

    public function canTransitionTo(self $to, UserRole $actor): bool
    {
        return match ([$this, $to]) {
            [self::Pending, self::Reviewed], [self::Reviewed, self::Rejected] => $actor === UserRole::Employer,
            [self::Pending, self::Withdrawn], [self::Reviewed, self::Withdrawn] => $actor === UserRole::Candidate,
            [self::Reviewed, self::Hired] => $actor === UserRole::Employer || $actor === UserRole::Candidate,
            default => false,
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Hired, self::Rejected, self::Withdrawn], true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
