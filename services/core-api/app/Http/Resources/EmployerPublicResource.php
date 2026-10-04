<?php

namespace App\Http\Resources;

use App\Models\Employer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * EmployerPublic in docs/openapi.yaml – safe for anyone to see.
 *
 * @mixin Employer
 */
class EmployerPublicResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_name' => $this->company_name,
            'verified' => $this->isVerified(),
            'industry' => $this->industry,
            'address' => $this->address,
            'location' => [
                'psgc_code' => $this->location_psgc,
                'label' => $this->location_label,
            ],
            'description' => $this->description,
            'logo_url' => $this->logo_path
                ? config('opendoor.public_api_url')."/employers/{$this->id}/logo?v={$this->updated_at?->timestamp}"
                : null,
            'trust_score' => $this->trustScoreSummary(),
        ];
    }
}
