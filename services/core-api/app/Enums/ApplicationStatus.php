<?php

namespace App\Enums;

/**
 * Application workflow (business-rules.md, Decision 2026-10-22b). The candidate sees Submitted
 * (pending) → Under review (reviewed) → Shortlisted → Contacted → Hired. Status never moves
 * backward; hired, rejected and withdrawn are final. The employer may skip stages forward.
 *
 *   pending → reviewed                                 employer (automatically when the employer opens it)
 *   any earlier stage → shortlisted | contacted        employer
 *   reviewed | shortlisted | contacted → rejected      employer
 *   pending | reviewed | shortlisted | contacted → withdrawn   candidate
 *   in progress → hired                                never here: only when the other party confirms
 *                                                      a hiring report (HiringReportController)
 */
enum ApplicationStatus: string
{
    case Pending = 'pending';
    case Reviewed = 'reviewed';
    case Shortlisted = 'shortlisted';
    case Contacted = 'contacted';
    case Hired = 'hired';
    case Rejected = 'rejected';
    case Withdrawn = 'withdrawn';

    /** The stages in order; skipping forward is allowed, going back is not. */
    private const STAGES = [self::Pending, self::Reviewed, self::Shortlisted, self::Contacted];

    public function canTransitionTo(self $to, UserRole $actor): bool
    {
        if (! $this->isInProgress()) {
            return false;
        }

        return match ($to) {
            self::Reviewed, self::Shortlisted, self::Contacted => $actor === UserRole::Employer
                && array_search($to, self::STAGES, true) > array_search($this, self::STAGES, true),
            self::Rejected => $actor === UserRole::Employer && $this !== self::Pending,
            self::Withdrawn => $actor === UserRole::Candidate,
            self::Pending, self::Hired => false,
        };
    }

    /** Still open: a hire can be reported, the candidate can withdraw. */
    public function isInProgress(): bool
    {
        return in_array($this, self::STAGES, true);
    }

    public function isFinal(): bool
    {
        return ! $this->isInProgress();
    }

    /** @return list<self> */
    public static function inProgress(): array
    {
        return self::STAGES;
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
