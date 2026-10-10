<?php

namespace App\Http\Resources;

use App\Models\Feedback;
use App\Models\FeedbackItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * AdminFeedback in docs/openapi.yaml: one response for moderation, without anything about the
 * candidate who wrote it (no application, profile or user data). Load
 * application.jobPosting.employer and items.accommodation before use.
 *
 * @mixin Feedback
 */
class AdminFeedbackResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $posting = $this->application->jobPosting;

        return [
            'id' => $this->id,
            'employer' => [
                'id' => $posting->employer->id,
                'company_name' => $posting->employer->company_name,
                'verified' => $posting->employer->isVerified(),
            ],
            'job_title' => $posting->title,
            'is_hidden' => $this->is_hidden,
            'comments' => $this->comments,
            'items' => $this->items
                ->sortBy(fn (FeedbackItem $item) => $item->accommodation->name)
                ->values()
                ->map(fn (FeedbackItem $item) => [
                    'accommodation_id' => $item->accommodation_id,
                    'name' => $item->accommodation->name,
                    'rating' => $item->rating,
                ])->all(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
