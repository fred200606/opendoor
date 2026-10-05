<?php

namespace App\Http\Resources;

use App\Models\RegistryCheck;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * RegistryResult in docs/openapi.yaml (admin only). The raw XML stays in the database.
 *
 * @mixin RegistryCheck
 */
class RegistryCheckResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'status' => $this->status,
            'registered_name' => $this->registered_name,
            'name_match' => $this->name_match_score,
            'checked_at' => $this->checked_at?->toIso8601String(),
        ];
    }
}
