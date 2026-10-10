<?php

namespace App\Http\Controllers\Candidate;

use App\Http\Controllers\Controller;
use App\Http\Controllers\JobPostingController;
use App\Http\Resources\JobPostingResource;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Services\NeedsMatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * M12: a candidate's bookmarked postings. Only visible postings (open, approved, not deleted) are
 * listed or can be saved; a bookmark on a posting that closes stays and shows again if it reopens.
 */
class SavedJobController extends Controller
{
    public const PER_PAGE = 12;

    /** Most recently saved first, with `match` like search results. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['page' => ['nullable', 'integer', 'min:1']]);

        $postings = CandidateProfile::for($request->user())->savedJobs()
            ->visible()
            ->with(JobPostingController::RELATIONS)
            ->orderByPivot('created_at', 'desc')
            ->orderByDesc('job_postings.id')
            ->paginate(self::PER_PAGE);

        $matcher = NeedsMatcher::for($request->user());
        $postings->getCollection()->each(function (JobPosting $posting) use ($matcher) {
            $posting->setAttribute('saved', true);
            $matcher?->annotate($posting);
        });

        return JobPostingResource::collection($postings);
    }

    /** Idempotent: 201 when newly saved, 200 when it already was. Hidden postings are 404. */
    public function store(Request $request, JobPosting $jobPosting): JsonResponse
    {
        abort_unless($jobPosting->isVisible(), 404);

        $changes = CandidateProfile::for($request->user())->savedJobs()->syncWithoutDetaching([$jobPosting->id]);

        $jobPosting->load(JobPostingController::RELATIONS)->setAttribute('saved', true);
        NeedsMatcher::for($request->user())?->annotate($jobPosting);

        return (new JobPostingResource($jobPosting))->response()->setStatusCode($changes['attached'] === [] ? 200 : 201);
    }

    /** Idempotent, by id: also removes a bookmark whose posting has since closed or been deleted. */
    public function destroy(Request $request, int $jobPosting): Response
    {
        CandidateProfile::for($request->user())->savedJobs()->detach($jobPosting);

        return response()->noContent();
    }
}
