<?php

namespace App\Models;

use App\Enums\FeedbackRating;
use App\Observers\FeedbackObserver;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\ObservedBy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

/**
 * M7: one anonymous response per contacted application. Employers only ever see the aggregated trust
 * score (TrustScoreService); is_hidden is changed only by admin moderation.
 */
#[ObservedBy(FeedbackObserver::class)]
#[Fillable(['comments'])]
class Feedback extends Model
{
    protected $table = 'feedback';

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_hidden' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_hidden' => 'boolean',
        ];
    }

    /**
     * Saves a response with its items in one transaction (the observer recomputes the trust score
     * after the commit, so it sees the items).
     *
     * @param  array<int, FeedbackRating|string>  $ratings  accommodation_id => rating
     */
    public static function submit(Application $application, array $ratings, ?string $comments = null): self
    {
        return DB::transaction(function () use ($application, $ratings, $comments) {
            $feedback = new self(['comments' => $comments]);
            $feedback->application()->associate($application);
            $feedback->save();
            $feedback->items()->createMany(collect($ratings)->map(fn ($rating, $accommodationId) => [
                'accommodation_id' => $accommodationId,
                'rating' => $rating,
            ])->values()->all());

            return $feedback;
        });
    }

    /** @return BelongsTo<Application, $this> */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /** @return HasMany<FeedbackItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(FeedbackItem::class);
    }
}
