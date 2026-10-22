<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\HiringReportStatus;
use App\Enums\JobPostingStatus;
use Carbon\CarbonImmutable;
use Database\Factories\ApplicationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * M6: a candidate's application to a posting. status and the stage dates are not fillable: they
 * change only through the status workflow (ApplicationStatus::canTransitionTo) and, for hired,
 * hire_start_date and hired_at, through a confirmed hiring report (Decision 2026-10-22b).
 */
#[Fillable(['cover_note', 'interview_request'])]
class Application extends Model
{
    /** @use HasFactory<ApplicationFactory> */
    use HasFactory;

    /** Feedback opens on calendar day 30 after the confirmed start date (business-rules.md). */
    public const FEEDBACK_AFTER_DAYS = 30;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'pending',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ApplicationStatus::class,
            'reviewed_at' => 'datetime',
            'shortlisted_at' => 'datetime',
            'contacted_at' => 'datetime',
            'hired_at' => 'datetime',
            'hire_start_date' => 'date',
            'feedback_reminded_at' => 'datetime',
        ];
    }

    /**
     * Soft-deleted postings keep their applications (and later their feedback).
     *
     * @return BelongsTo<JobPosting, $this>
     */
    public function jobPosting(): BelongsTo
    {
        return $this->belongsTo(JobPosting::class)->withTrashed();
    }

    /** @return BelongsTo<CandidateProfile, $this> */
    public function candidateProfile(): BelongsTo
    {
        return $this->belongsTo(CandidateProfile::class);
    }

    /**
     * The accommodations the posting advertised when this application became hired – the items
     * the candidate rates (M7). Recorded by recordHireSnapshot().
     *
     * @return BelongsToMany<Accommodation, $this>
     */
    public function accommodationsAtHire(): BelongsToMany
    {
        return $this->belongsToMany(Accommodation::class, 'application_accommodation');
    }

    /** @return HasOne<Feedback, $this> */
    public function feedback(): HasOne
    {
        return $this->hasOne(Feedback::class);
    }

    /**
     * Every hiring report with its answers, oldest first (the history on the application page).
     *
     * @return HasMany<HiringReport, $this>
     */
    public function hiringReports(): HasMany
    {
        return $this->hasMany(HiringReport::class)->orderBy('id');
    }

    /**
     * At most one at a time (HiringReportController).
     *
     * @return HasOne<HiringReport, $this>
     */
    public function pendingHiringReport(): HasOne
    {
        return $this->hasOne(HiringReport::class)->where('status', HiringReportStatus::Pending);
    }

    /** Hired by a confirmed report: the start date it agreed on decides when the rating opens. */
    public function markHired(HiringReport $report): void
    {
        $this->status = ApplicationStatus::Hired;
        $this->hired_at = now();
        $this->hire_start_date = $report->start_date;
        $this->save();
        $this->recordHireSnapshot();
    }

    /**
     * "Job closed" (Decision 2026-10-22b): still in progress while its posting is closed or deleted.
     * Only shown – the stage is kept and a hire can still be reported.
     */
    public function isJobClosed(): bool
    {
        return $this->status->isInProgress()
            && ($this->jobPosting?->trashed() || $this->jobPosting?->status === JobPostingStatus::Closed);
    }

    /** Same rule as isJobClosed() for lists and dashboards: true = only those, false = none of them. */
    #[Scope]
    protected function jobClosed(Builder $query, bool $closed = true): void
    {
        $postingClosed = fn (Builder $posting) => $posting->withTrashed()
            ->where(fn (Builder $q) => $q->where('job_postings.status', JobPostingStatus::Closed)->orWhereNotNull('job_postings.deleted_at'));

        if ($closed) {
            $query->whereIn('status', ApplicationStatus::inProgress())->whereHas('jobPosting', $postingClosed);
        } else {
            $query->where(fn (Builder $q) => $q->whereNotIn('status', ApplicationStatus::inProgress())->orWhereDoesntHave('jobPosting', $postingClosed));
        }
    }

    /** Copies the posting's current accommodations; call when the application becomes hired. */
    public function recordHireSnapshot(): void
    {
        $this->accommodationsAtHire()->sync(
            $this->jobPosting->accommodations()->pluck('accommodations.id'),
        );
    }

    /** Hired and on or after calendar day 30 after the confirmed start date (Manila). */
    public function isFeedbackOpen(): bool
    {
        $opensOn = $this->feedbackOpensOn();

        return $this->status === ApplicationStatus::Hired && $opensOn !== null && ! now()->lessThan($opensOn);
    }

    public function isByCandidate(?User $user): bool
    {
        return $user !== null && $this->candidateProfile?->user_id === $user->id;
    }

    public function isForEmployer(?User $user): bool
    {
        return $this->jobPosting?->isOwnedBy($user) ?? false;
    }

    /** Start date 1 Oct → feedback opens 31 Oct (Manila). Null until a hire is confirmed. */
    public function feedbackOpensOn(): ?CarbonImmutable
    {
        return $this->status === ApplicationStatus::Hired && $this->hire_start_date
            ? CarbonImmutable::parse($this->hire_start_date->toDateString(), 'Asia/Manila')->addDays(self::FEEDBACK_AFTER_DAYS)
            : null;
    }
}
