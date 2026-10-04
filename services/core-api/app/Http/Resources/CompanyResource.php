<?php

namespace App\Http\Resources;

use App\Models\Employer;
use Illuminate\Http\Request;

/**
 * Company in docs/openapi.yaml – the owner's (and admin's) view, with registration data.
 *
 * @mixin Employer
 */
class CompanyResource extends EmployerPublicResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'business_reg_no' => $this->business_reg_no,
            'registry_type' => $this->registry_type,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'verification_rejected_reason' => $this->verification_rejected_reason,
        ];
    }
}
