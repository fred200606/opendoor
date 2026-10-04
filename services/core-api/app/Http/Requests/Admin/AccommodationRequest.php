<?php

namespace App\Http\Requests\Admin;

use App\Enums\AccommodationGroup;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AccommodationRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('name'))) {
            $this->merge(['name' => trim($this->input('name'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:150', Rule::unique('accommodations', 'name')->ignore($this->route('accommodation'))],
            'group' => ['required', Rule::enum(AccommodationGroup::class)],
            'description' => ['nullable', 'string', 'max:255'],
            'is_retired' => ['sometimes', 'boolean'],
        ];
    }
}
