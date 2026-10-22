<?php

namespace App\Models;

use App\Enums\ApplicationStatus;
use App\Enums\HiringParty;
use App\Enums\HiringReportAction;
use App\Enums\HiringReportStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Decision 2026-10-22b: one party reports that the candidate was hired, with a proposed start
 * date; the application becomes hired only when the other party confirms. Reports and every
 * answer are kept as history, separate from the application's stage. Nothing here is fillable:
 * it changes only through HiringReportController (and withdrawals/rejections, which cancel it).
 */
class HiringReport extends Model
{
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
            'reported_by' => HiringParty::class,
            'status' => HiringReportStatus::class,
            'start_date' => 'date',
            'responded_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Application, $this> */
    public function application(): BelongsTo
    {
        return $this->belongsTo(Application::class);
    }

    /** @return HasMany<HiringReportEvent, $this> */
    public function events(): HasMany
    {
        return $this->hasMany(HiringReportEvent::class)->orderBy('id');
    }

    public function isPending(): bool
    {
        return $this->status === HiringReportStatus::Pending;
    }

    /** The party that has to answer. */
    public function respondent(): HiringParty
    {
        return $this->reported_by->other();
    }

    /**
     * A hire both parties already agreed on, for seeders and factories: reported by $by and
     * confirmed by the other party at $at. Marks the application hired from $startDate.
     */
    public static function recordConfirmed(Application $application, HiringParty $by, CarbonInterface $at, string $startDate): self
    {
        $users = [
            HiringParty::Employer->value => $application->jobPosting->employer->user,
            HiringParty::Candidate->value => $application->candidateProfile->user,
        ];
        $report = $application->hiringReports()->forceCreate([
            'reported_by' => $by,
            'reporter_id' => $users[$by->value]->id,
            'start_date' => $startDate,
            'status' => HiringReportStatus::Confirmed,
            'responded_at' => $at,
            'created_at' => $at,
            'updated_at' => $at,
        ]);
        $report->events()->forceCreate(['actor_role' => $by, 'actor_id' => $users[$by->value]->id, 'action' => HiringReportAction::Reported, 'start_date' => $startDate, 'created_at' => $at]);
        $report->events()->forceCreate(['actor_role' => $by->other(), 'actor_id' => $users[$by->other()->value]->id, 'action' => HiringReportAction::Confirmed, 'created_at' => $at]);

        $application->forceFill(['status' => ApplicationStatus::Hired, 'hired_at' => $at, 'hire_start_date' => $startDate])->save();
        $application->recordHireSnapshot();

        return $report;
    }

    public function record(HiringReportAction $action, HiringParty $by, ?User $actor, ?string $startDate = null): HiringReportEvent
    {
        return $this->events()->forceCreate([
            'actor_role' => $by,
            'actor_id' => $actor?->id,
            'action' => $action,
            'start_date' => $startDate,
            'created_at' => now(),
        ]);
    }
}
