<?php

namespace App\Http\Requests\Candidate;

use App\Enums\EducationLevel;
use App\Enums\EmploymentType;
use App\Enums\WorkSetup;
use App\Services\SkillCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'education_level' => ['nullable', Rule::enum(EducationLevel::class)],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:60'],
            'preferred_work_setups' => ['nullable', 'array', 'max:3'],
            'preferred_work_setups.*' => ['distinct', Rule::enum(WorkSetup::class)],
            'preferred_employment_types' => ['nullable', 'array', 'max:4'],
            'preferred_employment_types.*' => ['distinct', Rule::enum(EmploymentType::class)],
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
        return [
            'location_psgc.regex' => 'Choose the city or municipality from the list.',
            'experience_years.max' => 'Enter up to 60 years of experience.',
        ];
    }

    /**
     * The validated input with skills stored under their list names (Decision 2026-10-21).
     *
     * @return array<string, mixed>
     */
    public function profile(SkillCatalog $catalog): array
    {
        $data = $this->validated();
        if (isset($data['skills'])) {
            $data['skills'] = $catalog->normalize($data['skills']);
        }

        return $data;
    }
}
