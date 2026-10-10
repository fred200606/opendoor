<?php

namespace App\Http\Controllers\Admin;

use App\Enums\JobPostingStatus;
use App\Http\Controllers\Controller;
use App\Http\Controllers\JobPostingController;
use App\Http\Requests\Admin\ReviewPostingRequest;
use App\Http\Resources\JobPostingResource;
use App\Models\JobPosting;
use App\Notifications\PostingReviewed;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** M4 admin: posting approval queue. Approval never happens automatically. */
class PostingApprovalController extends Controller
{
    /** Default: the queue (pending_approval), oldest first so nothing waits forever. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $status = $request->validate(['status' => ['nullable', Rule::enum(JobPostingStatus::class)]])['status']
            ?? JobPostingStatus::PendingApproval->value;

        $postings = JobPosting::query()
            ->with(JobPostingController::RELATIONS)
            ->where('status', $status)
            ->when(
                $status === JobPostingStatus::PendingApproval->value,
                fn ($query) => $query->oldest('updated_at'),
                fn ($query) => $query->latest(),
            )
            ->paginate(12)
            ->withQueryString();

        return JobPostingResource::collection($postings);
    }

    /** approve: pending_approval → open. reject: pending_approval → draft with a reason for the employer. */
    public function review(ReviewPostingRequest $request, JobPosting $jobPosting): JobPostingResource
    {
        if ($jobPosting->status !== JobPostingStatus::PendingApproval) {
            throw ValidationException::withMessages(['action' => 'Only postings that are waiting for approval can be reviewed.']);
        }

        if ($request->validated('action') === 'approve') {
            if ($jobPosting->closes_at->isBefore(today())) {
                throw ValidationException::withMessages(['action' => 'The closing date has passed. Reject the posting with a reason so the employer can change the date.']);
            }
            $jobPosting->status = JobPostingStatus::Open;
            $jobPosting->is_approved = true;
            $jobPosting->rejection_reason = null;
        } else {
            $jobPosting->status = JobPostingStatus::Draft;
            $jobPosting->is_approved = false;
            $jobPosting->rejection_reason = $request->validated('reason');
        }

        $jobPosting->save();
        $jobPosting->employer->user->notify(new PostingReviewed($jobPosting));

        return new JobPostingResource($jobPosting->load(JobPostingController::RELATIONS));
    }
}
