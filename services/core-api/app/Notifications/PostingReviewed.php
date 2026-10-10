<?php

namespace App\Notifications;

use App\Enums\JobPostingStatus;
use App\Models\JobPosting;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/** M9 in-app notice to the employer when an admin approves a posting (now open) or sends it back to draft. */
class PostingReviewed extends Notification
{
    public function __construct(private readonly JobPosting $posting) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'posting_review';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $posting = $this->posting;
        $approved = $posting->status === JobPostingStatus::Open;

        return [
            'message' => $approved
                ? "Your posting {$posting->title} was approved and is now open to candidates."
                : "Your posting {$posting->title} was not approved: ".Str::finish(rtrim((string) $posting->rejection_reason, '.!? '), '.').' Edit it and submit it again.',
            'url' => $approved ? "/jobs/{$posting->id}" : "/employer/jobs/{$posting->id}/edit",
            'job_posting_id' => $posting->id,
            'approved' => $approved,
        ];
    }
}
