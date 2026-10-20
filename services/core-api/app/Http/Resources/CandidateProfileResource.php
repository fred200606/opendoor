<?php

namespace App\Http\Resources;

use App\Models\CandidateProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * CandidateProfile in docs/openapi.yaml – the candidate's own view. resume_url is a short-lived
 * signed link through the gateway (a browser link cannot send the Bearer token).
 *
 * @mixin CandidateProfile
 */
class CandidateProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'headline' => $this->headline,
            'skills' => $this->skills ?? [],
            'experience' => $this->experience,
            'education_level' => $this->education_level,
            'experience_years' => $this->experience_years,
            'preferred_work_setups' => $this->preferred_work_setups ?? [],
            'preferred_employment_types' => $this->preferred_employment_types ?? [],
            'location_psgc' => $this->location_psgc,
            'location' => ['psgc_code' => $this->location_psgc, 'label' => $this->location_label],
            'disability_type' => $this->disability_type,
            'show_disability' => $this->show_disability,
            'resume_url' => $this->resumeUrl(),
            'accommodations' => AccommodationResource::collection($this->whenLoaded('accommodations')),
        ];
    }
}
