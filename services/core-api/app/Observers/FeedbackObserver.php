<?php

namespace App\Observers;

use App\Models\Feedback;
use App\Services\TrustScoreService;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;

/**
 * Keeps employers.trust_score current. Runs after the commit, so a new response already has its
 * items when the score is recomputed.
 */
class FeedbackObserver implements ShouldHandleEventsAfterCommit
{
    public function __construct(private readonly TrustScoreService $trustScores) {}

    public function created(Feedback $feedback): void
    {
        $this->recalculate($feedback);
    }

    public function updated(Feedback $feedback): void
    {
        if ($feedback->wasChanged('is_hidden')) {
            $this->recalculate($feedback);
        }
    }

    public function deleted(Feedback $feedback): void
    {
        $this->recalculate($feedback);
    }

    private function recalculate(Feedback $feedback): void
    {
        $employer = $feedback->application?->jobPosting?->employer;
        if ($employer) {
            $this->trustScores->recalculate($employer);
        }
    }
}
