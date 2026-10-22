<?php

namespace App\Http\Resources;

use App\Enums\HiringParty;
use App\Models\Application;
use App\Models\HiringReport;
use App\Models\HiringReportEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Application in docs/openapi.yaml. Load ApplicationController::RELATIONS: jobPosting (with
 * JobPostingController::RELATIONS), feedback (candidates), hiringReports.events and, for employers,
 * candidateProfile.user + candidateProfile.accommodations.
 *
 * `job_closed`: still in progress while the posting is closed or deleted (the stage is kept).
 * `hiring_reports`: the hiring confirmation history, oldest first (Decision 2026-10-22b); only the
 * roles are shown, never who at the company answered.
 *
 * `candidate` only for the employer that owns the posting (RA 10173: needs are shared through the
 * application; the disability type only when the candidate chose to show it).
 *
 * @mixin Application
 */
class ApplicationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $forEmployer = $this->isForEmployer($request->user());

        return [
            'id' => $this->id,
            'job_posting_id' => $this->job_posting_id,
            'job_posting' => new JobPostingResource($this->whenLoaded('jobPosting')),
            'candidate' => $this->when($forEmployer, fn () => $this->candidate()),
            'status' => $this->status,
            'cover_note' => $this->cover_note,
            'interview_request' => $this->interview_request,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'shortlisted_at' => $this->shortlisted_at?->toIso8601String(),
            'contacted_at' => $this->contacted_at?->toIso8601String(),
            'hired_at' => $this->hired_at?->toIso8601String(),
            'hire_start_date' => $this->hire_start_date?->toDateString(),
            'job_closed' => $this->isJobClosed(),
            'hiring_reports' => $this->whenLoaded('hiringReports', fn () => $this->hiringReports->map(fn (HiringReport $report) => [
                'id' => $report->id,
                'reported_by' => $report->reported_by,
                'start_date' => $report->start_date->toDateString(),
                'status' => $report->status,
                'can_respond' => $report->isPending() && $report->respondent() === ($forEmployer ? HiringParty::Employer : HiringParty::Candidate),
                'created_at' => $report->created_at?->toIso8601String(),
                'responded_at' => $report->responded_at?->toIso8601String(),
                'events' => $report->events->map(fn (HiringReportEvent $event) => [
                    'actor_role' => $event->actor_role,
                    'action' => $event->action,
                    'start_date' => $event->start_date?->toDateString(),
                    'created_at' => $event->created_at?->toIso8601String(),
                ])->all(),
            ])->all()),
            'feedback_opens_on' => $this->feedbackOpensOn()?->toDateString(),
            // Only the candidate learns whether they rated (feedback is anonymous to employers).
            'feedback_submitted' => $this->when(! $forEmployer, fn () => $this->feedback !== null),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function candidate(): array
    {
        $profile = $this->candidateProfile;

        return [
            'name' => $profile->user->name,
            'headline' => $profile->headline,
            'skills' => $profile->skills ?? [],
            'experience' => $profile->experience,
            'education_level' => $profile->education_level,
            'experience_years' => $profile->experience_years,
            'accommodations' => AccommodationResource::collection($profile->accommodations),
            'disability_type' => $profile->show_disability ? $profile->disability_type : null,
            'resume_url' => $profile->resumeUrl(),
        ];
    }
}
