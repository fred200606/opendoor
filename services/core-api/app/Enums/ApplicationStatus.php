<?php

namespace App\Enums;

/**
 * Application workflow (business-rules.md, Decision 2026-10-22a). The candidate sees Submitted
 * (pending) → Under review (reviewed) → Shortlisted → Contacted. Status never moves backward;
 * contacted, rejected and withdrawn are final. Contacted replaced "hired": it opens the
 * accommodation rating 30 days later.
 *
 *   pending → reviewed                          employer (automatically when the employer opens it)
 *   reviewed → shortlisted                      employer
 *   reviewed | shortlisted → contacted          employer, or candidate ("The employer contacted me")
 *   reviewed | shortlisted → rejected           employer
 *   pending | reviewed | shortlisted → withdrawn  candidate
 */
enum ApplicationStatus: string
{
    case Pending = 'pending';
    case Reviewed = 'reviewed';
    case Shortlisted = 'shortlisted';
    case Contacted = 'contacted';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';

    public function canTransitionTo(self $to, UserRole $actor): bool
    {
        return match ([$this, $to]) {
            [self::Pending, self::Reviewed],
            [self::Reviewed, self::Shortlisted],
            [self::Reviewed, self::Rejected], [self::Shortlisted, self::Rejected] => $actor === UserRole::Employer,
            [self::Pending, self::Withdrawn], [self::Reviewed, self::Withdrawn], [self::Shortlisted, self::Withdrawn] => $actor === UserRole::Candidate,
            [self::Reviewed, self::Contacted], [self::Shortlisted, self::Contacted] => $actor === UserRole::Employer || $actor === UserRole::Candidate,
            default => false,
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Contacted, self::Rejected, self::Withdrawn], true);
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
