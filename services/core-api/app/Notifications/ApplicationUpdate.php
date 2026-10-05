<?php

namespace App\Notifications;

use App\Enums\ApplicationStatus;
use App\Enums\HireConfirmedBy;
use App\Models\Application;
use Illuminate\Notifications\Notification;

/**
 * M9 in-app notice for the other party whenever an application is created or changes status.
 * `data.message` is plain language; `data.url` is the in-app page to open (OpenAPI Notification).
 */
class ApplicationUpdate extends Notification
{
    public function __construct(private readonly Application $application) {}

    /** Notifies the party that did not make the change (needs jobPosting.employer.user, candidateProfile.user). */
    public static function sendFor(Application $application): void
    {
        $recipient = self::forEmployer($application)
            ? $application->jobPosting->employer->user
            : $application->candidateProfile->user;

        $recipient->notify(new self($application));
    }

    /** The candidate applied, withdrew or confirmed the hire → tell the employer; otherwise the candidate. */
    private static function forEmployer(Application $application): bool
    {
        return match ($application->status) {
            ApplicationStatus::Pending, ApplicationStatus::Withdrawn => true,
            ApplicationStatus::Hired => $application->hire_confirmed_by === HireConfirmedBy::Candidate,
            ApplicationStatus::Reviewed, ApplicationStatus::Rejected => false,
        };
    }

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return $this->application->status === ApplicationStatus::Pending ? 'application_received' : 'application_status_changed';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $application = $this->application;
        $title = $application->jobPosting->title;
        $company = $application->jobPosting->employer->company_name;
        $candidate = $application->candidateProfile->user->name;

        $message = match ($application->status) {
            ApplicationStatus::Pending => "{$candidate} applied for {$title}.",
            ApplicationStatus::Reviewed => "{$company} is reviewing your application for {$title}.",
            ApplicationStatus::Rejected => "{$company} decided not to continue with your application for {$title}.",
            ApplicationStatus::Withdrawn => "{$candidate} withdrew the application for {$title}.",
            ApplicationStatus::Hired => $application->hire_confirmed_by === HireConfirmedBy::Candidate
                ? "{$candidate} confirmed being hired for {$title}."
                : "Congratulations! {$company} marked you as hired for {$title}. You can rate the promised accommodations from ".$application->feedbackOpensOn()->format('F j, Y').'.',
        };

        return [
            'message' => $message,
            'url' => (self::forEmployer($application) ? '/employer/applications/' : '/candidate/applications/').$application->id,
            'application_id' => $application->id,
            'status' => $application->status->value,
        ];
    }
}
