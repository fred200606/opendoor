<?php

namespace App\Models;

use App\Enums\EducationLevel;
use App\Support\PublicUrl;
use Database\Factories\CandidateProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A candidate's profile and accommodation needs. Needs drive matching (M5);
 * disability_type never does (RA 10173).
 */
#[Fillable(['headline', 'skills', 'experience', 'education_level', 'experience_years', 'preferred_work_setups', 'preferred_employment_types', 'location_psgc', 'location_label', 'disability_type', 'show_disability'])]
class CandidateProfile extends Model
{
    /** @use HasFactory<CandidateProfileFactory> */
    use HasFactory;

    public const RESUME_LINK_MINUTES = 30;

    /** @var array<string, mixed> */
    protected $attributes = [
        'show_disability' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'skills' => 'array',
            'education_level' => EducationLevel::class,
            'experience_years' => 'integer',
            'preferred_work_setups' => 'array',
            'preferred_employment_types' => 'array',
            'show_disability' => 'boolean',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsToMany<Accommodation, $this> */
    public function accommodations(): BelongsToMany
    {
        return $this->belongsToMany(Accommodation::class, 'candidate_accommodation');
    }

    /** @return HasMany<Application, $this> */
    public function applications(): HasMany
    {
        return $this->hasMany(Application::class);
    }

    /**
     * M12 bookmarks; the pivot's created_at is when the candidate saved the posting.
     *
     * @return BelongsToMany<JobPosting, $this>
     */
    public function savedJobs(): BelongsToMany
    {
        return $this->belongsToMany(JobPosting::class, 'saved_jobs')->withTimestamps();
    }

    /** The candidate's profile; a new candidate gets an empty one on first access (never a 404). */
    public static function for(User $user): self
    {
        if (! $user->candidateProfile) {
            $profile = new self;
            $profile->user()->associate($user);
            $profile->save();
            // fresh(): a just-created model would make a resource answer 201 instead of 200.
            $user->setRelation('candidateProfile', $profile->fresh());
        }

        return $user->candidateProfile;
    }

    /**
     * Short-lived signed link through the gateway (a browser link cannot send the Bearer token).
     * Given only to the candidate and to employers the candidate applied to.
     */
    public function resumeUrl(): ?string
    {
        return $this->resume_path
            ? PublicUrl::signed('resumes.show', ['candidateProfile' => $this->id], now()->addMinutes(self::RESUME_LINK_MINUTES))
            : null;
    }
}
