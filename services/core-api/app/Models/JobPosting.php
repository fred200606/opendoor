<?php

namespace App\Models;

use App\Enums\EducationLevel;
use App\Enums\EmploymentType;
use App\Enums\InterviewFormat;
use App\Enums\JobPostingStatus;
use App\Enums\WorkSetup;
use Database\Factories\JobPostingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * status, is_approved and rejection_reason are not fillable: they change only through the
 * submit flag and the open/close endpoint. is_approved is true once a verified employer published
 * the posting (kept for older rows; there is no admin approval step any more).
 */
#[Fillable(['category_id', 'title', 'description', 'skills', 'education_level', 'experience_years', 'qualifications', 'address', 'location_psgc', 'location_label', 'employment_type', 'work_setup', 'interview_format', 'closes_at'])]
class JobPosting extends Model
{
    /** @use HasFactory<JobPostingFactory> */
    use HasFactory, SoftDeletes;

    /** @var array<string, mixed> */
    protected $attributes = [
        'status' => 'draft',
        'is_approved' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => JobPostingStatus::class,
            'employment_type' => EmploymentType::class,
            'work_setup' => WorkSetup::class,
            'interview_format' => InterviewFormat::class,
            'closes_at' => 'date',
            'is_approved' => 'boolean',
            'skills' => 'array',
            'education_level' => EducationLevel::class,
            'experience_years' => 'integer',
        ];
    }

    /** @return BelongsTo<Employer, $this> */
    public function employer(): BelongsTo
    {
        return $this->belongsTo(Employer::class);
    }

    /** @return BelongsTo<Category, $this> */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /** @return BelongsToMany<Accommodation, $this> */
    public function accommodations(): BelongsToMany
    {
        return $this->belongsToMany(Accommodation::class, 'job_posting_accommodation')->withPivot('note');
    }

    /** @return HasMany<Application, $this> */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * Candidates who bookmarked this posting (M12).
     *
     * @return BelongsToMany<CandidateProfile, $this>
     */
    public function savedBy(): BelongsToMany
    {
        return $this->belongsToMany(CandidateProfile::class, 'saved_jobs')->withTimestamps();
    }

    /** Visible and still before the end of `closes_at` (Manila) – the cron may not have run yet. */
    public function acceptsApplications(): bool
    {
        return $this->isVisible() && ! $this->closes_at->copy()->endOfDay()->isPast();
    }

    /**
     * Postings anyone may see: open, approved, not soft-deleted and from a verified employer that
     * is not suspended (search, matching, snapshot). Lifting the suspension or verifying the
     * company again shows them again.
     */
    #[Scope]
    protected function visible(Builder $query): void
    {
        $query->where('status', JobPostingStatus::Open)->where('is_approved', true)
            ->whereHas('employer', fn (Builder $employer) => $employer->whereNotNull('verified_at')
                ->whereRelation('user', 'is_active', true));
    }

    public function isVisible(): bool
    {
        return $this->status === JobPostingStatus::Open && $this->is_approved && ! $this->trashed()
            && (bool) $this->employer?->isVerified() && $this->ownerIsActive();
    }

    /** False while the employer's account is suspended (M10). */
    public function ownerIsActive(): bool
    {
        return (bool) $this->employer?->user?->is_active;
    }

    public function isOwnedBy(?User $user): bool
    {
        return $user !== null && $this->employer?->user_id === $user->id;
    }
}
