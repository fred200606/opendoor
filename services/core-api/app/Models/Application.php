<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\HireConfirmedBy;
use Carbon\CarbonImmutable;
use Database\Factories\ApplicationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * M6: a candidate's application to a posting. status, hired_at and hire_confirmed_by are not
 * fillable: they change only through the status workflow (ApplicationStatus::canTransitionTo).
 */
#[Fillable(['cover_note', 'interview_request'])]
class Application extends Model
{
    /** @use HasFactory<ApplicationFactory> */
    use HasFactory;

    /** Feedback opens on calendar day 30 after the hire date (business-rules.md). */
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
            'hire_confirmed_by' => HireConfirmedBy::class,
            'hired_at' => 'datetime',
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

    public function isByCandidate(?User $user): bool
    {
        return $user !== null && $this->candidateProfile?->user_id === $user->id;
    }

    public function isForEmployer(?User $user): bool
    {
        return $this->jobPosting?->isOwnedBy($user) ?? false;
    }

    /** Hired on 1 Oct (any time, Manila) → feedback opens 31 Oct. Null until hired. */
    public function feedbackOpensOn(): ?CarbonImmutable
    {
        return $this->hired_at
            ? CarbonImmutable::parse($this->hired_at)->timezone('Asia/Manila')->startOfDay()->addDays(self::FEEDBACK_AFTER_DAYS)
            : null;
    }
}
