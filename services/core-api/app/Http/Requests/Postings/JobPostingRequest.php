<?php

namespace App\Http\Requests\Postings;

use App\Enums\EmploymentType;
use App\Enums\InterviewFormat;
use App\Enums\WorkSetup;
use App\Models\JobPosting;
use App\Rules\UsableAccommodation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Create and update a posting (JobPostingInput in docs/openapi.yaml). */
class JobPostingRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['title', 'address', 'location_label'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
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
        ];
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
