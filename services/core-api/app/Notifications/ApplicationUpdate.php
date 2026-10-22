<?php

namespace App\Notifications;

use App\Enums\ApplicationStatus;
use App\Enums\ContactConfirmedBy;
use App\Models\Application;

/**
 * M9 in-app notice (and M13 email) for the other party whenever an application is created or
 * changes status. `data.message` is plain language; `data.url` is the in-app page to open
 * (OpenAPI Notification).
 */
class ApplicationUpdate extends AppNotice
{
    public function __construct(private readonly Application $application)
    {
        parent::__construct();
    }

    /** Notifies the party that did not make the change (needs jobPosting.employer.user, candidateProfile.user). */
    public static function sendFor(Application $application): void
    {
        $recipient = self::forEmployer($application)
            ? $application->jobPosting->employer->user
            : $application->candidateProfile->user;

        $recipient->notify(new self($application));
    }

    /** The candidate applied, withdrew or confirmed the contact → tell the employer; otherwise the candidate. */
    private static function forEmployer(Application $application): bool
    {
        return match ($application->status) {
            ApplicationStatus::Pending, ApplicationStatus::Withdrawn => true,
            ApplicationStatus::Contacted => $application->contact_confirmed_by === ContactConfirmedBy::Candidate,
            ApplicationStatus::Reviewed, ApplicationStatus::Shortlisted, ApplicationStatus::Rejected => false,
        };
    }

    protected function subject(object $notifiable): string
    {
        $title = $this->application->jobPosting->title;

        return $this->application->status === ApplicationStatus::Pending ? "New application for {$title}" : "Application update: {$title}";
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
            ApplicationStatus::Shortlisted => "Good news: {$company} shortlisted you for {$title}.",
            ApplicationStatus::Rejected => "{$company} decided not to continue with your application for {$title}.",
            ApplicationStatus::Withdrawn => "{$candidate} withdrew the application for {$title}.",
            ApplicationStatus::Contacted => $application->contact_confirmed_by === ContactConfirmedBy::Candidate
                ? "{$candidate} confirmed that you contacted them about {$title}."
                : "{$company} reached out to you about the next steps for {$title}. You can rate the promised accommodations from ".$application->feedbackOpensOn()->format('F j, Y').'.',
        };

        return [
            'message' => $message,
            'url' => (self::forEmployer($application) ? '/employer/applications/' : '/candidate/applications/').$application->id,
            'application_id' => $application->id,
            'status' => $application->status->value,
        ];
    }
}
