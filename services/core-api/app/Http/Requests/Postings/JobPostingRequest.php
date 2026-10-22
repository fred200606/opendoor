<?php

namespace App\Http\Requests\Postings;

use App\Enums\EducationLevel;
use App\Enums\EmploymentType;
use App\Enums\InterviewFormat;
use App\Enums\SalaryPeriod;
use App\Enums\WorkSetup;
use App\Models\JobPosting;
use App\Rules\UsableAccommodation;
use App\Services\SkillCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and update a posting (JobPostingInput in docs/openapi.yaml). */
class JobPostingRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['title', 'address', 'location_label', 'qualifications', 'responsibilities', 'benefits', 'schedule', 'application_requirements'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
        if (is_array($this->input('skills'))) {
            $this->merge(['skills' => array_values(array_filter(
                array_map(fn ($skill) => is_string($skill) ? trim($skill) : $skill, $this->input('skills')),
                fn ($skill) => $skill !== '' && $skill !== null,
            ))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $posting = $this->route('jobPosting');

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            // A published job names at least one skill (Decision 2026-10-21); a draft may still lack them.
            'skills' => [Rule::requiredIf($this->boolean('submit')), 'nullable', 'array', 'max:20'],
            'skills.*' => ['string', 'max:50'],
            'education_level' => ['nullable', Rule::enum(EducationLevel::class)],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:40'],
            'qualifications' => ['nullable', 'string', 'max:2000'],
            // Optional job details (Decision 2026-10-22e). A salary is whole pesos per period;
            // a single amount is a minimum without a maximum.
            'responsibilities' => ['nullable', 'string', 'max:4000'],
            'salary_min' => ['nullable', 'required_with:salary_max', 'integer', 'min:1', 'max:10000000'],
            'salary_max' => ['nullable', 'integer', 'max:10000000', 'gte:salary_min'],
            'salary_period' => ['nullable', 'required_with:salary_min', Rule::enum(SalaryPeriod::class)],
            'benefits' => ['nullable', 'string', 'max:2000'],
            'schedule' => ['nullable', 'string', 'max:255'],
            'application_requirements' => ['nullable', 'string', 'max:2000'],
            'category_id' => ['required', 'integer', Rule::exists('categories', 'id')],
            'address' => ['required', 'string', 'max:255'],
            'location_psgc' => ['nullable', 'string', 'regex:/^\d{9,10}$/'],
            'location_label' => ['nullable', 'string', 'max:255'],
            'employment_type' => ['required', Rule::enum(EmploymentType::class)],
            'work_setup' => ['required', Rule::enum(WorkSetup::class)],
            'interview_format' => ['required', Rule::enum(InterviewFormat::class)],
            // 'today' is evaluated in APP_TIMEZONE (Asia/Manila).
            'closes_at' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'accommodations' => ['present', 'array', 'max:30'],
            'accommodations.*.id' => ['required', 'integer', 'distinct', new UsableAccommodation($this->attachedIds($posting))],
            'accommodations.*.note' => ['nullable', 'string', 'max:255'],
            'submit' => ['sometimes', 'boolean'],
        ];
    }

    /** @return list<int> */
    private function attachedIds(?JobPosting $posting): array
    {
        return $posting ? $posting->accommodations()->pluck('accommodations.id')->all() : [];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'closes_at.after_or_equal' => 'The closing date cannot be in the past.',
            'accommodations.*.id.distinct' => 'Each accommodation can be listed only once.',
            'location_psgc.regex' => 'Choose the city or municipality from the list.',
            'skills.required' => 'List at least one skill this job needs.',
            'experience_years.max' => 'Ask for at most 40 years of experience.',
            'salary_min.required_with' => 'Enter the lowest salary too, or leave both amounts empty.',
            'salary_max.gte' => 'The highest salary cannot be lower than the lowest.',
            'salary_period.required_with' => 'Choose what the salary is paid per.',
        ];
    }

    /**
     * The posting's own fields (not accommodations or the submit flag), skills under their list names.
     *
     * @return array<string, mixed>
     */
    public function posting(SkillCatalog $catalog): array
    {
        $data = $this->safe()->except(['accommodations', 'submit']);
        if (isset($data['skills'])) {
            $data['skills'] = $catalog->normalize($data['skills']);
        }
        // A period without an amount means nothing: no salary disclosed (Decision 2026-10-22e).
        if (array_key_exists('salary_min', $data) && $data['salary_min'] === null) {
            $data['salary_period'] = null;
        }

        return $data;
    }

    /**
     * @return array<int, array{id: int, note: string|null}>
     */
    public function accommodations(): array
    {
        return collect($this->validated('accommodations'))
            ->mapWithKeys(fn (array $item) => [(int) $item['id'] => ['note' => isset($item['note']) && trim($item['note']) !== '' ? trim($item['note']) : null]])
            ->all();
    }
}
