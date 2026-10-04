<?php

namespace App\Models;

use Database\Factories\EmployerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * verified_at, verification_rejected_reason, trust_score and feedback_count are not fillable:
 * only admin verification (Phase 6) and the TrustScoreService (Phase 5) change them.
 */
#[Fillable(['company_name', 'business_reg_no', 'registry_type', 'industry', 'address', 'location_psgc', 'location_label', 'description'])]
class Employer extends Model
{
    /** Trust scores are published from this many non-hidden feedback responses. */
    public const TRUST_SCORE_MIN_RESPONSES = 3;

    /** @use HasFactory<EmployerFactory> */
    use HasFactory;

    /** @var array<string, mixed> */
    protected $attributes = [
        'feedback_count' => 0,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
            'trust_score' => 'integer',
            'feedback_count' => 'integer',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /**
     * @return array{published: bool, score: int|null, based_on: int}
     */
    public function trustScoreSummary(): array
    {
        $published = $this->feedback_count >= self::TRUST_SCORE_MIN_RESPONSES && $this->trust_score !== null;

        return [
            'published' => $published,
            'score' => $published ? $this->trust_score : null,
            'based_on' => $this->feedback_count,
        ];
    }
}
