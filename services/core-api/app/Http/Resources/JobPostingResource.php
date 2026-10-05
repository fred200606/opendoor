<?php

namespace App\Http\Resources;

use App\Models\JobPosting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * JobPosting in docs/openapi.yaml. Load employer, category and accommodations before use.
 * `match` is filled by the matching service (M5); `rejection_reason` only for owner and admins.
 *
 * @mixin JobPosting
 */
class JobPostingResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $viewer = $request->user('sanctum');
        $privileged = $this->isOwnedBy($viewer) || (bool) $viewer?->isAdmin();

        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'employer' => [
                'id' => $this->employer->id,
                'company_name' => $this->employer->company_name,
                'verified' => $this->employer->isVerified(),
            ],
            'category' => new CategoryResource($this->category),
            'address' => $this->address,
            'location' => ['psgc_code' => $this->location_psgc, 'label' => $this->location_label],
            'employment_type' => $this->employment_type,
            'work_setup' => $this->work_setup,
            'interview_format' => $this->interview_format,
            'status' => $this->status,
            'closes_at' => $this->closes_at->toDateString(),
            'accommodations' => AccommodationResource::collection($this->whenLoaded('accommodations')),
            'match' => $this->resource->getAttribute('match'),
            'trust_score' => $this->employer->trustScoreSummary(),
            'rejection_reason' => $this->when($privileged, $this->rejection_reason),
            // Details only, for candidates (null when they have not applied).
            'my_application' => $this->when(array_key_exists('my_application', $this->resource->getAttributes()), fn () => $this->resource->getAttribute('my_application')),
            'applicants_count' => $this->when($privileged && isset($this->applications_count), fn () => $this->applications_count),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
