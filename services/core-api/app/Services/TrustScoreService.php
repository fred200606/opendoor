<?php

namespace App\Services;

use App\Models\Employer;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * M7 trust score (business-rules.md): delivered = 1, partial = 0.5, not delivered = 0 across all
 * rated items of the employer's non-hidden feedback, as a whole percentage (half away from zero).
 * Stored on employers.trust_score / feedback_count; published from 3 responses.
 * Employers never see single responses – only these aggregates.
 */
class TrustScoreService
{
    /** Recomputes and stores the score; called by FeedbackObserver after every change. */
    public function recalculate(Employer $employer): void
    {
        DB::transaction(function () use ($employer) {
            // Serializes concurrent recalculations for the same employer (last write sees all feedback).
            Employer::query()->lockForUpdate()->find($employer->id);

            $totals = $this->items($employer)
                ->selectRaw("COUNT(*) AS rated, SUM(CASE feedback_items.rating WHEN 'delivered' THEN 2 WHEN 'partial' THEN 1 ELSE 0 END) AS half_points")
                ->first();
            $responses = $this->responses($employer)->count();

            // A direct update: $employer may be a stale cached instance (Eloquent would skip
            // "unchanged" columns), and updated_at stays as is (logo_url uses it to bust caches).
            $values = [
                'trust_score' => self::percentage((int) $totals->half_points, (int) $totals->rated),
                'feedback_count' => $responses,
            ];
            Employer::query()->whereKey($employer->id)->toBase()->update($values);
            $employer->forceFill($values)->syncOriginal();
        });
    }

    /**
     * Counts per accommodation; empty until the score is published (a breakdown of one or two
     * responses would reveal what single employees answered).
     *
     * @return list<array{accommodation_id: int, name: string, delivered: int, partial: int, not_delivered: int, of: int}>
     */
    public function breakdown(Employer $employer): array
    {
        if (! $employer->trustScoreSummary()['published']) {
            return [];
        }

        return $this->items($employer)
            ->join('accommodations', 'accommodations.id', '=', 'feedback_items.accommodation_id')
            ->groupBy('feedback_items.accommodation_id', 'accommodations.name')
            ->orderBy('accommodations.name')
            ->selectRaw("feedback_items.accommodation_id, accommodations.name,
                SUM(CASE WHEN feedback_items.rating = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN feedback_items.rating = 'partial' THEN 1 ELSE 0 END) AS partial,
                SUM(CASE WHEN feedback_items.rating = 'not_delivered' THEN 1 ELSE 0 END) AS not_delivered,
                COUNT(*) AS rated")
            ->get()
            ->map(fn (object $row) => [
                'accommodation_id' => (int) $row->accommodation_id,
                'name' => $row->name,
                'delivered' => (int) $row->delivered,
                'partial' => (int) $row->partial,
                'not_delivered' => (int) $row->not_delivered,
                'of' => (int) $row->rated,
            ])
            ->all();
    }

    /**
     * round(points / rated * 100), half away from zero, in integers (points are counted in halves,
     * so no float rounding error): round(x / y) = intdiv(2x + y, 2y) with x = 100 · half_points, y = 2 · rated.
     */
    public static function percentage(int $halfPoints, int $rated): ?int
    {
        return $rated > 0 ? intdiv(200 * $halfPoints + 2 * $rated, 4 * $rated) : null;
    }

    /** Non-hidden responses to the employer's postings (soft-deleted postings included). */
    private function responses(Employer $employer): Builder
    {
        return DB::table('feedback')
            ->join('applications', 'applications.id', '=', 'feedback.application_id')
            ->join('job_postings', 'job_postings.id', '=', 'applications.job_posting_id')
            ->where('job_postings.employer_id', $employer->id)
            ->where('feedback.is_hidden', false);
    }

    private function items(Employer $employer): Builder
    {
        return $this->responses($employer)->join('feedback_items', 'feedback_items.feedback_id', '=', 'feedback.id');
    }
}
