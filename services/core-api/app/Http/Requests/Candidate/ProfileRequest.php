<?php

namespace App\Http\Requests\Candidate;

use Illuminate\Foundation\Http\FormRequest;

/** CandidateProfileInput in docs/openapi.yaml. */
class ProfileRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $merge = [];
        foreach (['headline', 'experience', 'location_label', 'disability_type'] as $field) {
            if (is_string($this->input($field))) {
                $value = trim($this->input($field));
                $merge[$field] = $value === '' ? null : $value;
            }
        }
        if (is_array($this->input('skills'))) {
            $merge['skills'] = array_values(array_unique(array_filter(
                array_map(fn ($skill) => is_string($skill) ? trim($skill) : $skill, $this->input('skills')),
                fn ($skill) => $skill !== '' && $skill !== null, // '' arrives as null (ConvertEmptyStringsToNull)
            )));
        }
        $this->merge($merge);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'headline' => ['nullable', 'string', 'max:255'],
            'skills' => ['nullable', 'array', 'max:30'],
            'skills.*' => ['string', 'max:50'],
            'experience' => ['nullable', 'string', 'max:5000'],
            'location_psgc' => ['nullable', 'string', 'regex:/^\d{9,10}$/'],
            'location_label' => ['nullable', 'string', 'max:255'],
            'disability_type' => ['nullable', 'string', 'max:100'],
            'show_disability' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['location_psgc.regex' => 'Choose the city or municipality from the list.'];
    }
}
