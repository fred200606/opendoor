<?php

namespace App\Notifications;

use App\Models\JobPosting;
use Illuminate\Support\Str;

/**
 * M9 in-app notice (and M13 email) to the employer when an admin removes a posting, with the
 * reason. Postings are no longer approved one by one (Decision 2026-10-21), so removal is the only
 * posting review left; the type stays `posting_review` with `approved:false, removed:true`.
 */
class PostingReviewed extends AppNotice
{
    public function __construct(private readonly JobPosting $posting, private readonly string $removedReason)
    {
        parent::__construct();
    }

    protected function subject(object $notifiable): string
    {
        return "Your job posting {$this->posting->title} was removed";
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
        return [
            'message' => "Your posting {$this->posting->title} was removed by an administrator: ".Str::finish(rtrim($this->removedReason, '.!? '), '.'),
            // The posting itself is gone; its edit page would be a 404.
            'url' => '/employer/jobs',
            'job_posting_id' => $this->posting->id,
            'approved' => false,
            'removed' => true,
        ];
    }
}
