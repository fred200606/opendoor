<?php

namespace App\Models;

use Database\Factories\CandidateProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * A candidate's profile and accommodation needs. Needs drive matching (M5);
 * disability_type never does (RA 10173).
 */
#[Fillable(['headline', 'skills', 'experience', 'location_psgc', 'location_label', 'disability_type', 'show_disability'])]
class CandidateProfile extends Model
{
    /** @use HasFactory<CandidateProfileFactory> */
    use HasFactory;

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
}
