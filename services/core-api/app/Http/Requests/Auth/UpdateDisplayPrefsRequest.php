<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** M13 display settings; the values are the ones the account page offers. */
class UpdateDisplayPrefsRequest extends FormRequest
{
    public const TEXT_SIZES = ['100', '125', '150'];

    public const CONTRASTS = ['normal', 'high'];

    public const MOTIONS = ['normal', 'reduce'];

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'text_size' => ['required', Rule::in(self::TEXT_SIZES)],
            'contrast' => ['required', Rule::in(self::CONTRASTS)],
            'motion' => ['required', Rule::in(self::MOTIONS)],
        ];
    }

    /** @return array{text_size: string, contrast: string, motion: string} */
    public function prefs(): array
    {
        return [
            'text_size' => (string) $this->validated('text_size'),
            'contrast' => $this->validated('contrast'),
            'motion' => $this->validated('motion'),
        ];
    }
}
