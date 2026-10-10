<?php

namespace App\Models;

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
 * submit flag, the open/close endpoint and admin approval.
 */
#[Fillable(['category_id', 'title', 'description', 'address', 'location_psgc', 'location_label', 'employment_type', 'work_setup', 'interview_format', 'closes_at'])]
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

    /** Open, approved and still before the end of `closes_at` (Manila) – the cron may not have run yet. */
    /**
     * Candidates who bookmarked this posting (M12).
     *
     * @return BelongsToMany<CandidateProfile, $this>
     */
    public function savedBy(): BelongsToMany
    {
        return $this->belongsToMany(CandidateProfile::class, 'saved_jobs')->withTimestamps();
    }

    public function acceptsApplications(): bool
    {
        return $this->isVisible() && ! $this->closes_at->copy()->endOfDay()->isPast();
    }

    /** Postings anyone may see: open, approved and not soft-deleted (search, matching, snapshot). */
    #[Scope]
    protected function visible(Builder $query): void
    {
        $query->where('status', JobPostingStatus::Open)->where('is_approved', true);
    }

    public function isVisible(): bool
    {
        return $this->status === JobPostingStatus::Open && $this->is_approved && ! $this->trashed();
    }

    public function isOwnedBy(?User $user): bool
    {
        return $user !== null && $this->employer?->user_id === $user->id;
    }
}
