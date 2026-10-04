<?php

namespace App\Http\Controllers\Employer;

use App\Enums\JobPostingStatus;
use App\Http\Controllers\Controller;
use App\Http\Controllers\JobPostingController;
use App\Http\Resources\JobPostingResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/** M4: the employer's own postings in every status. */
class PostingController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate(['status' => ['nullable', Rule::enum(JobPostingStatus::class)]]);
        $employer = $request->user()->employer;

        if (! $employer) {
            return JobPostingResource::collection(collect())->additional(['meta' => ['current_page' => 1, 'per_page' => 12, 'total' => 0, 'last_page' => 1]]);
        }

        $postings = $employer->jobPostings()
            ->with(JobPostingController::RELATIONS)
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate(12);

        return JobPostingResource::collection($postings);
    }
}
