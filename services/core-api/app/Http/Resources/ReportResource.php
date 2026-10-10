<?php

namespace App\Http\Resources;

use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Report in docs/openapi.yaml. `job_posting` (with the employer) when loaded for admin lists;
 * the admin's note and resolution time only for admins.
 *
 * @mixin Report
 */
class ReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isAdmin = (bool) $request->user()?->isAdmin();

        return [
            'id' => $this->id,
            'job_posting_id' => $this->job_posting_id,
            'job_posting' => $this->whenLoaded('jobPosting', fn () => [
                'id' => $this->jobPosting->id,
                'title' => $this->jobPosting->title,
                'employer' => [
                    'id' => $this->jobPosting->employer->id,
                    'company_name' => $this->jobPosting->employer->company_name,
                    'verified' => $this->jobPosting->employer->isVerified(),
                ],
            ]),
            'reason' => $this->reason,
            'status' => $this->status,
            'note' => $this->when($isAdmin, fn () => $this->note),
            'resolved_at' => $this->when($isAdmin, fn () => $this->resolved_at?->toIso8601String()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
