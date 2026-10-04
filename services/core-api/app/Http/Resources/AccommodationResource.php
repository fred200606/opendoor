<?php

namespace App\Http\Resources;

use App\Models\Accommodation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Accommodation
 */
class AccommodationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'group' => $this->group,
            'description' => $this->description,
            'is_retired' => $this->is_retired,
            // Only on a posting's accommodations.
            'note' => $this->whenPivotLoaded('job_posting_accommodation', fn () => $this->pivot->note),
        ];
    }
}
