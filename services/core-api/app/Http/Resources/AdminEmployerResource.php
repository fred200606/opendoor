<?php

namespace App\Http\Resources;

use App\Models\Employer;
use Illuminate\Http\Request;

/**
 * AdminEmployer in docs/openapi.yaml: the company with its owner and the latest registry check
 * for the registration on file (load user and latestRegistryCheck).
 *
 * @mixin Employer
 */
class AdminEmployerResource extends CompanyResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $check = $this->currentRegistryCheck();

        return [
            ...parent::toArray($request),
            'owner' => [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'email' => $this->user->email,
            ],
            'latest_registry_check' => $check ? (new RegistryCheckResource($check))->resolve($request) : null,
        ];
    }
}
