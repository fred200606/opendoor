<?php

namespace App\Notifications;

use App\Enums\JobPostingStatus;
use App\Models\JobPosting;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * M9 in-app notice to the employer when an admin approves a posting (now open), sends it back to
 * draft, or removes it (with `$removedReason`).
 */
class PostingReviewed extends Notification
{
    public function __construct(private readonly JobPosting $posting, private readonly ?string $removedReason = null)
    {
        $this->id = (string) Str::uuid7(); // time-ordered: see NotificationController::index
    }

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

        if ($this->removedReason !== null) {
            return [
                'message' => "Your posting {$posting->title} was removed by an administrator: ".Str::finish(rtrim($this->removedReason, '.!? '), '.'),
                // The posting itself is gone; its edit page would be a 404.
                'url' => '/employer/jobs',
                'job_posting_id' => $posting->id,
                'approved' => false,
                'removed' => true,
            ];
        }

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
