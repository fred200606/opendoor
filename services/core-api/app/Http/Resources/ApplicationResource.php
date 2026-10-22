<?php

namespace App\Http\Resources;

use App\Models\Application;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Application in docs/openapi.yaml. Load jobPosting (with JobPostingController::RELATIONS),
 * feedback (candidates) and, for employers, candidateProfile.user + candidateProfile.accommodations.
 *
 * `candidate` only for the employer that owns the posting (RA 10173: needs are shared through the
 * application; the disability type only when the candidate chose to show it).
 *
 * @mixin Application
 */
class ApplicationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $forEmployer = $this->isForEmployer($request->user());

        return [
            'id' => $this->id,
            'job_posting_id' => $this->job_posting_id,
            'job_posting' => new JobPostingResource($this->whenLoaded('jobPosting')),
            'candidate' => $this->when($forEmployer, fn () => $this->candidate()),
            'status' => $this->status,
            'cover_note' => $this->cover_note,
            'interview_request' => $this->interview_request,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'shortlisted_at' => $this->shortlisted_at?->toIso8601String(),
            'contacted_at' => $this->contacted_at?->toIso8601String(),
            'contact_confirmed_by' => $this->contact_confirmed_by,
            'feedback_opens_on' => $this->feedbackOpensOn()?->toDateString(),
            // Only the candidate learns whether they rated (feedback is anonymous to employers).
            'feedback_submitted' => $this->when(! $forEmployer, fn () => $this->feedback !== null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function candidate(): array
    {
        $profile = $this->candidateProfile;

        return [
            'name' => $profile->user->name,
            'headline' => $profile->headline,
            'skills' => $profile->skills ?? [],
            'experience' => $profile->experience,
            'education_level' => $profile->education_level,
            'experience_years' => $profile->experience_years,
            'accommodations' => AccommodationResource::collection($profile->accommodations),
            'disability_type' => $profile->show_disability ? $profile->disability_type : null,
            'resume_url' => $profile->resumeUrl(),
        ];
    }
}
