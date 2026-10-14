<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

/** Onboarding: the welcome tour was finished or skipped, the "Get started" list hidden or shown again. */
class UpdateOnboardingRequest extends FormRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // A partial update: send only what changed, but at least one of them.
        return [
            'tour_done' => ['required_without:checklist_hidden', 'boolean'],
            'checklist_hidden' => ['required_without:tour_done', 'boolean'],
        ];
    }

    /** @return array<string, bool> the changed columns */
    public function changes(): array
    {
        $changes = [];
        foreach (['tour_done', 'checklist_hidden'] as $field) {
            if ($this->has($field)) {
                $changes["onboarding_{$field}"] = $this->boolean($field);
            }
        }

        return $changes;
    }
}
