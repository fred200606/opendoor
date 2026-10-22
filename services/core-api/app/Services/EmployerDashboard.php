<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\HiringParty;
use App\Enums\HiringReportStatus;
use App\Models\Application;
use App\Models\Employer;
use App\Models\HiringReport;
use App\Models\HiringReportEvent;
use Illuminate\Database\Eloquent\Builder;

/**
 * The employer dashboard's work list, activity feed and weekly chart (Decision 2026-10-22f).
 * Only the employer's own applicants, by name – never their needs or disability.
 */
class EmployerDashboard
{
    public const RECENT = 8;

    public function __construct(private readonly ?Employer $employer) {}

    /** @return array<string, mixed> */
    public function summary(): array
    {
        return [
            'attention' => $this->attention(),
            'recent_activity' => $this->recentActivity(),
            'weeks' => $this->weeks(),
        ];
    }

    /**
     * Applications to the employer's postings, deleted ones included (as the rest of the dashboard).
     *
     * @return Builder<Application>
     */
    private function applications(): Builder
    {
        return Application::query()->whereHas(
            'jobPosting',
            fn (Builder $posting) => $posting->withTrashed()->where('employer_id', $this->employer?->id),
        );
    }

    /**
     * What waits for the employer: new applications per job (not opened yet, job still open) and
     * hiring reports by candidates that the employer has to answer.
     *
     * @return array{new_applications: list<array<string, mixed>>, hiring_reports: list<array<string, mixed>>}
     */
    private function attention(): array
    {
        $new = $this->applications()
            ->where('status', ApplicationStatus::Pending)
            ->jobClosed(false)
            ->with('jobPosting:id,title')
            ->get(['id', 'job_posting_id'])
            ->groupBy('job_posting_id')
            ->map(fn ($applications) => [
                'job_posting_id' => $applications->first()->job_posting_id,
                'title' => $applications->first()->jobPosting->title,
                'count' => $applications->count(),
            ])
            ->sortBy([['count', 'desc'], ['title', 'asc']])
            ->values()
            ->all();

        $reports = HiringReport::query()
            ->where('status', HiringReportStatus::Pending)
            ->where('reported_by', HiringParty::Candidate)
            ->whereIn('application_id', $this->applications()->select('id'))
            ->with(['application.jobPosting:id,title', 'application.candidateProfile.user:id,name'])
            ->orderBy('created_at')
            ->get()
            ->map(fn (HiringReport $report) => [
                'application_id' => $report->application_id,
                'hiring_report_id' => $report->id,
                'job_title' => $report->application->jobPosting->title,
                'candidate_name' => $report->application->candidateProfile?->user?->name,
                'start_date' => $report->start_date->toDateString(),
            ])
            ->all();

        return ['new_applications' => $new, 'hiring_reports' => $reports];
    }

    /**
     * The latest applications received and hiring report steps (reported, confirmed, not yet,
     * disputed, cancelled), newest first.
     *
     * @return list<array<string, mixed>>
     */
    private function recentActivity(): array
    {
        $received = $this->applications()
            ->with(['jobPosting:id,title', 'candidateProfile.user:id,name'])
            ->latest('created_at')
            ->latest('id')
            ->limit(self::RECENT)
            ->get()
            ->map(fn (Application $application) => [
                'type' => 'application_received',
                'by' => HiringParty::Candidate->value,
                'application_id' => $application->id,
                'job_title' => $application->jobPosting->title,
                'candidate_name' => $application->candidateProfile?->user?->name,
                'at' => $application->created_at->toIso8601String(),
            ]);

        $hiring = HiringReportEvent::query()
            ->whereHas('hiringReport', fn (Builder $report) => $report->whereIn('application_id', $this->applications()->select('id')))
            ->with(['hiringReport.application.jobPosting:id,title', 'hiringReport.application.candidateProfile.user:id,name'])
            ->latest('created_at')
            ->latest('id')
            ->limit(self::RECENT)
            ->get()
            ->map(fn (HiringReportEvent $event) => [
                'type' => 'hiring_'.$event->action->value,
                'by' => $event->actor_role->value,
                'application_id' => $event->hiringReport->application_id,
                'job_title' => $event->hiringReport->application->jobPosting->title,
                'candidate_name' => $event->hiringReport->application->candidateProfile?->user?->name,
                'at' => $event->created_at->toIso8601String(),
            ]);

        return $received->concat($hiring)->sortByDesc('at')->take(self::RECENT)->values()->all();
    }

    /** @return list<array<string, int|string>> applications received and hires confirmed per Manila week */
    private function weeks(): array
    {
        $since = AdminAnalytics::firstWeek()->timezone(config('app.timezone'));

        return AdminAnalytics::perWeek([
            'applications' => $this->applications()->where('created_at', '>=', $since)->pluck('created_at'),
            'hires' => $this->applications()->where('status', ApplicationStatus::Hired)->where('hired_at', '>=', $since)->pluck('hired_at'),
        ]);
    }
}
