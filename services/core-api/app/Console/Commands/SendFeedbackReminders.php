<?php

namespace App\Console\Commands;

use App\Enums\ApplicationStatus;
use App\Models\Application;
use App\Notifications\FeedbackReminder;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * M13: tells each hired, unrated candidate once that the feedback form is open (calendar day 30
 * after the hire, Manila). Missed days are caught up; suspended candidates are reminded after
 * reactivation. Emails go out when the command ends (AppNotice). Runs daily.
 */
#[Signature('feedback:remind')]
#[Description('Remind hired candidates that they can now rate the promised accommodations')]
class SendFeedbackReminders extends Command
{
    public function handle(): int
    {
        $sent = 0;

        Application::query()
            ->where('status', ApplicationStatus::Hired)
            ->whereNull('feedback_reminded_at')
            ->whereDoesntHave('feedback')
            // Every open form has a hire at least 29 days ago; isFeedbackOpen() checks the exact day.
            ->where('hired_at', '<=', now()->subDays(Application::FEEDBACK_AFTER_DAYS - 1))
            ->whereHas('candidateProfile.user', fn (Builder $user) => $user->where('is_active', true))
            ->with(['jobPosting.employer', 'candidateProfile.user'])
            ->chunkById(100, function (Collection $applications) use (&$sent) {
                foreach ($applications->filter->isFeedbackOpen() as $application) {
                    DB::transaction(function () use ($application) {
                        $application->candidateProfile->user->notify(new FeedbackReminder($application));
                        $application->forceFill(['feedback_reminded_at' => now()])->save();
                    });
                    $sent++;
                }
            });

        $this->info("Sent {$sent} rating reminder(s).");

        return self::SUCCESS;
    }
}
