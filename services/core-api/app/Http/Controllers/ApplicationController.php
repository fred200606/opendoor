<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStatus;
use App\Enums\HireConfirmedBy;
use App\Enums\JobPostingStatus;
use App\Enums\UserRole;
use App\Exceptions\ApiException;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Models\User;
use App\Notifications\ApplicationUpdate;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** M6: apply, list, details and the server-enforced status workflow (ApplicationStatus). */
class ApplicationController extends Controller
{
    private const RELATIONS = [
        'jobPosting.employer.user', 'jobPosting.category', 'jobPosting.accommodations',
        'candidateProfile.user', 'candidateProfile.accommodations', 'feedback:id,application_id',
    ];

    public function store(Request $request, JobPosting $jobPosting): JsonResponse
    {
        // Drafts, postings waiting for approval and those of a suspended employer stay hidden (404); closed ones say so.
        $closed = $jobPosting->status === JobPostingStatus::Closed && $jobPosting->is_approved && $jobPosting->ownerIsActive();
        if (! $closed && ! $jobPosting->isVisible()) {
            throw new ApiException('NOT_FOUND', 'The requested resource was not found.', 404);
        }
        if (! $jobPosting->acceptsApplications()) {
            throw new ApiException('POSTING_CLOSED', 'This job is no longer accepting applications.', 422);
        }

        $data = $request->validate([
            'cover_note' => ['nullable', 'string', 'max:2000'],
            'interview_request' => ['nullable', 'string', 'max:1000'],
        ]);

        $profile = CandidateProfile::for($request->user());
        $application = new Application($data);
        $application->jobPosting()->associate($jobPosting);
        $application->candidateProfile()->associate($profile);

        try {
            $application->save();
        } catch (UniqueConstraintViolationException) {
            throw new ApiException('ALREADY_APPLIED', 'You have already applied to this posting.', 409);
        }

        $application->load(self::RELATIONS);
        ApplicationUpdate::sendFor($application);

        return (new ApplicationResource($application))->response()->setStatusCode(201);
    }

    /** Candidate: own applications. Employer: applications to own postings (also soft-deleted ones). */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ApplicationStatus::class)],
            'job_posting_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $applications = $this->visibleTo($request->user())
            ->with(self::RELATIONS)
            ->when($filters['status'] ?? null, fn (Builder $query, string $status) => $query->where('status', $status))
            ->when($filters['job_posting_id'] ?? null, fn (Builder $query, $id) => $query->where('job_posting_id', $id))
            ->latest()
            ->orderByDesc('id')
            ->paginate(12)
            ->withQueryString();

        return ApplicationResource::collection($applications);
    }

    /** The employer opening a pending application marks it reviewed (and tells the candidate). */
    public function show(Request $request, Application $application): ApplicationResource
    {
        Gate::authorize('view', $application);
        $application->load(self::RELATIONS);

        $user = $request->user();
        if ($application->status === ApplicationStatus::Pending && $application->isForEmployer($user)) {
            $application = $this->transition($application, ApplicationStatus::Reviewed, $user);
        }

        return new ApplicationResource($application);
    }

    public function updateStatus(Request $request, Application $application): ApplicationResource
    {
        Gate::authorize('changeStatus', $application);

        $to = ApplicationStatus::from($request->validate([
            'status' => ['required', Rule::in(['reviewed', 'hired', 'rejected', 'withdrawn'])],
        ])['status']);

        return new ApplicationResource($this->transition($application, $to, $request->user()));
    }

    /**
     * Applies one workflow step under a row lock (two clicks or both parties at once cannot both
     * succeed), then notifies the other party.
     */
    private function transition(Application $application, ApplicationStatus $to, User $actor): Application
    {
        $actorRole = $application->isByCandidate($actor) ? UserRole::Candidate : UserRole::Employer;

        $application = DB::transaction(function () use ($application, $to, $actorRole) {
            $locked = Application::query()->lockForUpdate()->findOrFail($application->id);
            if (! $locked->status->canTransitionTo($to, $actorRole)) {
                throw new ApiException(
                    'INVALID_STATUS_TRANSITION',
                    "An application that is {$locked->status->value} cannot be changed to {$to->value}.",
                    422,
                );
            }

            $locked->status = $to;
            if ($to === ApplicationStatus::Hired) {
                $locked->hired_at = now();
                $locked->hire_confirmed_by = $actorRole === UserRole::Candidate ? HireConfirmedBy::Candidate : HireConfirmedBy::Employer;
            }
            $locked->save();
            if ($to === ApplicationStatus::Hired) {
                $locked->recordHireSnapshot();
            }

            return $locked;
        });

        $application->load(self::RELATIONS);
        ApplicationUpdate::sendFor($application);

        return $application;
    }

    /** @return Builder<Application> */
    private function visibleTo(User $user): Builder
    {
        if ($user->role === UserRole::Candidate) {
            return Application::query()->whereHas('candidateProfile', fn (Builder $profile) => $profile->where('user_id', $user->id));
        }

        return Application::query()->whereHas(
            'jobPosting',
            fn (Builder $posting) => $posting->withTrashed()->whereHas('employer', fn (Builder $employer) => $employer->where('user_id', $user->id)),
        );
    }
}
