<?php

namespace App\Rules;

use App\Models\Accommodation;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * The accommodation exists and is active. A type retired after it was attached may stay on the
 * record that already has it (pass those ids as $alreadyAttached).
 */
class UsableAccommodation implements ValidationRule
{
    /**
     * @param  list<int>  $alreadyAttached
     */
    public function __construct(private readonly array $alreadyAttached = []) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $accommodation = is_numeric($value) ? Accommodation::find($value) : null;

        if (! $accommodation) {
            $fail('This accommodation type does not exist.');
        } elseif ($accommodation->is_retired && ! in_array($accommodation->id, $this->alreadyAttached, true)) {
            $fail("“{$accommodation->name}” is no longer offered as an option.");
        }
    }
}
