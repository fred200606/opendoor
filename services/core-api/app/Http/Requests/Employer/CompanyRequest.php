<?php

namespace App\Http\Requests\Employer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompanyRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $trimmed = [];
        foreach (['company_name', 'business_reg_no', 'industry', 'address', 'location_label', 'description'] as $field) {
            if (is_string($this->input($field))) {
                $trimmed[$field] = trim($this->input($field));
            }
        }
        if (isset($trimmed['business_reg_no'])) {
            $trimmed['business_reg_no'] = strtoupper($trimmed['business_reg_no']);
        }
        // Empty optional text from multipart forms arrives as '' – store null.
        foreach (['location_psgc', 'location_label', 'description'] as $field) {
            if (($trimmed[$field] ?? $this->input($field)) === '') {
                $trimmed[$field] = null;
            }
        }
        $this->merge($trimmed);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $ownId = $this->user()->employer?->id;

        return [
            'company_name' => ['required', 'string', 'max:255'],
            'registry_type' => ['required', Rule::in(['DTI', 'SEC'])],
            'business_reg_no' => [
                'required',
                'string',
                'max:50',
                'regex:/^[A-Z0-9-]+$/',
                Rule::unique('employers', 'business_reg_no')->where('registry_type', $this->input('registry_type'))->ignore($ownId),
            ],
            'industry' => ['required', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:255'],
            'location_psgc' => ['nullable', 'string', 'regex:/^\d{9,10}$/'],
            'location_label' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'logo' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:'.config('opendoor.logo_max_kb')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'business_reg_no.regex' => 'Use only letters, numbers and dashes for the registration number.',
            'business_reg_no.unique' => 'Another company on OpenDoor already uses this registration number.',
            'location_psgc.regex' => 'Choose the city or municipality from the list.',
            'logo.max' => 'The logo must not be larger than 2 MB.',
        ];
    }
}
