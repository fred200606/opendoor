<?php

namespace App\Notifications;

use App\Models\Application;

/** M13 in-app notice (and email) to a hired candidate on the day the accommodation rating opens. Sent by feedback:remind. */
class FeedbackReminder extends AppNotice
{
    public function __construct(private readonly Application $application)
    {
        parent::__construct();
    }

    protected function subject(object $notifiable): string
    {
        return "Rate the accommodations for {$this->application->jobPosting->title}";
    }

    public function databaseType(object $notifiable): string
    {
        return 'feedback_reminder';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $posting = $this->application->jobPosting;

        return [
            'message' => "You can now rate the accommodations {$posting->employer->company_name} promised for {$posting->title}. Your answers are anonymous.",
            'url' => "/candidate/applications/{$this->application->id}/feedback",
            'application_id' => $this->application->id,
        ];
    }
}
