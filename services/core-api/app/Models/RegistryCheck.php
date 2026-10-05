<?php

namespace App\Models;

use App\Enums\RegistryStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One Business Registry (SOAP) check. Written only by Admin\EmployerVerificationController;
 * raw_response is the registry's XML answer (never the request: it carries the WS-Security password).
 */
class RegistryCheck extends Model
{
    public $timestamps = false;

    /** Below this name similarity the admin screen asks for a careful look (SIA 4.3). */
    public const NAME_MATCH_THRESHOLD = 0.80;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => RegistryStatus::class,
            'name_match_score' => 'float',
            'checked_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Employer, $this> */
    public function employer(): BelongsTo
    {
        return $this->belongsTo(Employer::class);
    }

    /** @return BelongsTo<User, $this> */
    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    /** True when this check was made for the registration the employer has now. */
    public function isFor(Employer $employer): bool
    {
        return $this->business_reg_no === $employer->business_reg_no && $this->registry_type === $employer->registry_type;
    }
}
