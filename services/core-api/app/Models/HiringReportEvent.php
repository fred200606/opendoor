<?php

namespace App\Models;

use App\Enums\HiringParty;
use App\Enums\HiringReportAction;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One step in a hiring report's history: reported, confirmed, not yet, disputed or cancelled. */
class HiringReportEvent extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'actor_role' => HiringParty::class,
            'action' => HiringReportAction::class,
            'start_date' => 'date',
        ];
    }

    /** @return BelongsTo<HiringReport, $this> */
    public function hiringReport(): BelongsTo
    {
        return $this->belongsTo(HiringReport::class);
    }
}
