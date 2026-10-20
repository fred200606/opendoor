<?php

namespace App\Http\Controllers;

use App\Enums\JobPostingStatus;
use App\Enums\UserRole;
use App\Exceptions\ApiException;
use App\Http\Requests\Postings\JobPostingRequest;
use App\Http\Resources\JobPostingResource;
use App\Models\JobPosting;
use App\Services\MatchingService;
use App\Services\SkillCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** M4 job postings (create, read, update, delete, open/close). Search is M5 (JobSearchController). */
class JobPostingController extends Controller
{
    public const RELATIONS = ['employer', 'category', 'accommodations'];

    /**
     * Public for open postings; owners and admins also see their drafts. Others get 404, not 403.
     * Candidates also get `match` (MatchingService).
     */
    public function show(Request $request, JobPosting $jobPosting): JobPostingResource
    {
        if (! Gate::forUser($request->user('sanctum'))->allows('view', $jobPosting)) {
            throw new ApiException('NOT_FOUND', 'The requested resource was not found.', 404);
        }

        $viewer = $request->user('sanctum');
        $jobPosting->load(self::RELATIONS);
        MatchingService::for($viewer)?->annotate($jobPosting);

        // A candidate sees an earlier application instead of the apply form, and whether it is saved (M12).
        if ($viewer?->role === UserRole::Candidate) {
            $application = $jobPosting->applications()->whereHas('candidateProfile', fn ($profile) => $profile->where('user_id', $viewer->id))->first();
            $jobPosting->setAttribute('my_application', $application ? [
                'id' => $application->id,
                'status' => $application->status,
                'created_at' => $application->created_at->toIso8601String(),
            ] : null);
            $jobPosting->setAttribute('saved', $jobPosting->savedBy()->where('user_id', $viewer->id)->exists());
        }

        return new JobPostingResource($jobPosting);
    }

    public function store(JobPostingRequest $request, SkillCatalog $catalog): JsonResponse
    {
        $employer = $request->user()->employer
            ?? throw ValidationException::withMessages(['company' => 'Create your company profile before posting a job.']);

        $posting = new JobPosting($request->posting($catalog));
        $posting->employer()->associate($employer);
        $posting->status = JobPostingStatus::Draft;
        if ($request->boolean('submit')) {
            $this->publish($posting);
        }

        DB::transaction(function () use ($posting, $request) {
            $posting->save();
            $posting->accommodations()->sync($request->accommodations());
        });

        return (new JobPostingResource($posting->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    /**
     * submit=true publishes the posting (also an open or closed one, with the changes); only a
     * verified employer may publish. submit=false is only for postings that are still drafts.
     */
    public function update(JobPostingRequest $request, JobPosting $jobPosting, SkillCatalog $catalog): JobPostingResource
    {
        Gate::authorize('update', $jobPosting);

        $submit = $request->boolean('submit');
        if (! $submit && $jobPosting->status !== JobPostingStatus::Draft) {
            throw ValidationException::withMessages(['submit' => 'A published posting cannot go back to draft. Publish your changes instead.']);
        }

        $jobPosting->fill($request->posting($catalog));
        if ($submit) {
            $this->publish($jobPosting);
        }

        DB::transaction(function () use ($jobPosting, $request) {
            $jobPosting->save();
            $jobPosting->accommodations()->sync($request->accommodations());
        });

        return new JobPostingResource($jobPosting->load(self::RELATIONS));
    }

    /** Soft delete: the posting leaves search; applications already received stay. */
    public function destroy(JobPosting $jobPosting): Response
    {
        Gate::authorize('delete', $jobPosting);
        $jobPosting->delete();

        return response()->noContent();
    }

    /**
     * Opens the posting right away (Decision 2026-10-21: no admin approval step). Only a verified
     * company may publish; an unverified one can still save drafts.
     */
    private function publish(JobPosting $posting): void
    {
        if (! $posting->employer->isVerified()) {
            throw ValidationException::withMessages(['submit' => 'Your company must be verified by an administrator before you can publish job postings. You can save this posting as a draft for now.']);
        }

        $posting->status = JobPostingStatus::Open;
        $posting->is_approved = true;
        $posting->rejection_reason = null;
    }

    /** open → closed any time; closed → open only for a verified company and before the closing date. */
    public function updateStatus(Request $request, JobPosting $jobPosting): JobPostingResource
    {
        Gate::authorize('changeStatus', $jobPosting);
        $target = JobPostingStatus::from($request->validate(['status' => ['required', Rule::in(['open', 'closed'])]])['status']);

        $allowed = match ($target) {
            JobPostingStatus::Closed => $jobPosting->status === JobPostingStatus::Open,
            JobPostingStatus::Open => $jobPosting->status === JobPostingStatus::Closed && $jobPosting->is_approved,
            default => false,
        };
        if (! $allowed) {
            throw ValidationException::withMessages(['status' => $target === JobPostingStatus::Open
                ? 'Only a published posting that was closed can be opened again.'
                : 'Only an open posting can be closed.']);
        }
        if ($target === JobPostingStatus::Open && ! $jobPosting->employer->isVerified()) {
            throw ValidationException::withMessages(['status' => 'Your company must be verified by an administrator before the posting can be opened again.']);
        }
        if ($target === JobPostingStatus::Open && $jobPosting->closes_at->isBefore(today())) {
            throw ValidationException::withMessages(['status' => 'The closing date has passed. Change the closing date and submit the posting again.']);
        }

        $jobPosting->status = $target;
        $jobPosting->save();

        return new JobPostingResource($jobPosting->load(self::RELATIONS));
    }
}
