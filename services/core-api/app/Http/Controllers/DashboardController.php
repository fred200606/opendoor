<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStatus;
use App\Enums\JobPostingStatus;
use App\Enums\ReportStatus;
use App\Enums\UserRole;
use App\Models\Application;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\Report;
use App\Models\User;
use BackedEnum;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * M8 dashboards (CandidateDashboard, EmployerDashboard, AdminDashboard in docs/openapi.yaml).
 * Counts are zero-filled for every status and agree with the lists the dashboard links to.
 */
class DashboardController extends Controller
{
    public function candidate(Request $request): JsonResponse
    {
        $profile = $request->user()->candidateProfile;
        if (! $profile) {
            return response()->json([
                'applications' => $this->countByStatus(Application::query()->whereRaw('1 = 0'), ApplicationStatus::class),
                'needs_count' => 0,
                'matching_jobs' => 0,
                'feedback_due' => [],
            ]);
        }

        $applications = Application::query()->where('candidate_profile_id', $profile->id);
        $needIds = $profile->accommodations()->pluck('accommodations.id');

        // Open postings offering every saved need (same visibility as search; none without needs).
        $matchingJobs = $needIds->isEmpty() ? 0 : JobPosting::query()->visible()
            ->whereHas('accommodations', fn (Builder $offered) => $offered->whereIn('accommodations.id', $needIds), '=', $needIds->count())
            ->count();

        $feedbackDue = (clone $applications)
            ->where('status', ApplicationStatus::Contacted)
            ->whereDoesntHave('feedback')
            ->with('jobPosting.employer')
            ->orderBy('contacted_at')
            ->orderBy('id')
            ->get()
            ->map(fn (Application $application) => [
                'application_id' => $application->id,
                'job_title' => $application->jobPosting->title,
                'company_name' => $application->jobPosting->employer->company_name,
                'opens_on' => $application->feedbackOpensOn()->toDateString(),
                'is_open' => $application->isFeedbackOpen(),
            ]);

        return response()->json([
            'applications' => $this->countByStatus($applications, ApplicationStatus::class),
            'needs_count' => $needIds->count(),
            'matching_jobs' => $matchingJobs,
            'feedback_due' => $feedbackDue,
        ]);
    }

    public function employer(Request $request): JsonResponse
    {
        $employer = $request->user()->employer;

        // Applicants include applications to postings the employer has since deleted (same as the list).
        $applications = Application::query()->whereHas(
            'jobPosting',
            fn (Builder $posting) => $posting->withTrashed()->where('employer_id', $employer?->id),
        );

        return response()->json([
            'company' => [
                'exists' => $employer !== null,
                'verified' => (bool) $employer?->isVerified(),
                'verification_rejected_reason' => $employer?->verification_rejected_reason,
            ],
            'postings' => $this->countByStatus(JobPosting::query()->where('employer_id', $employer?->id), JobPostingStatus::class),
            'applications' => $this->countByStatus($applications, ApplicationStatus::class),
            'trust_score' => $employer?->trustScoreSummary() ?? ['published' => false, 'score' => null, 'based_on' => 0],
        ]);
    }

    /** Platform analytics; postings deleted by their employer (and their applications) are left out. */
    public function admin(): JsonResponse
    {
        $users = User::query()->selectRaw('role, count(*) as total')->groupBy('role')->pluck('total', 'role');

        return response()->json([
            'users' => [
                ...collect(UserRole::values())->mapWithKeys(fn (string $role) => [$role => (int) ($users[$role] ?? 0)]),
                'suspended' => User::query()->where('is_active', false)->count(),
            ],
            'postings' => $this->countByStatus(JobPosting::query(), JobPostingStatus::class),
            'applications' => $this->countByStatus(
                Application::query()->whereHas('jobPosting', fn (Builder $posting) => $posting->whereNull('job_postings.deleted_at')),
                ApplicationStatus::class,
            ),
            // Same rule as the admin verification queue (Admin\EmployerVerificationController, status=pending).
            'verification_queue' => Employer::query()->whereNull('verified_at')->whereNull('verification_rejected_reason')->count(),
            'open_reports' => Report::query()->where('status', ReportStatus::Open)->count(),
            'feedback' => [
                'responses' => Feedback::query()->count(),
                'hidden' => Feedback::query()->where('is_hidden', true)->count(),
            ],
            'published_trust_scores' => Employer::query()
                ->where('feedback_count', '>=', Employer::TRUST_SCORE_MIN_RESPONSES)
                ->whereNotNull('trust_score')
                ->count(),
        ]);
    }

    /**
     * @param  Builder<Model>  $query
     * @param  class-string<BackedEnum>  $enum
     * @return array<string, int>
     */
    private function countByStatus(Builder $query, string $enum): array
    {
        $totals = (clone $query)->toBase()->reorder()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return collect($enum::cases())->mapWithKeys(fn (BackedEnum $case) => [$case->value => (int) ($totals[$case->value] ?? 0)])->all();
    }
}
