<?php

namespace App\Http\Controllers\Admin;

use App\Enums\JobPostingStatus;
use App\Http\Controllers\Controller;
use App\Http\Controllers\JobPostingController;
use App\Http\Resources\JobPostingResource;
use App\Models\JobPosting;
use App\Notifications\PostingReviewed;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * M4/M10 admin: every posting, and removal of inappropriate ones. Postings of verified employers
 * are published without approval (Decision 2026-10-21), so there is no approval queue.
 */
class PostingModerationController extends Controller
{
    /** All postings, or one status; newest first. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $status = $request->validate(['status' => ['nullable', Rule::enum(JobPostingStatus::class)]])['status'] ?? null;

        $postings = JobPosting::query()
            ->with(JobPostingController::RELATIONS)
            ->when($status, fn ($query) => $query->where('status', $status))
            ->latest()
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString();

        return JobPostingResource::collection($postings);
    }

    /**
     * Removes a posting in any status (e.g. after a report): soft delete, so applications and
     * feedback stay. The employer is told why. Already removed → 404 (route binding).
     */
    public function destroy(Request $request, JobPosting $jobPosting): Response
    {
        $reason = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ], [
            'reason.required' => 'Tell the employer why the posting is removed.',
        ])['reason'];

        $jobPosting->delete();
        $jobPosting->employer->user->notify(new PostingReviewed($jobPosting, $reason));

        return response()->noContent();
    }
}
