<?php

namespace Database\Factories;

use App\Enums\ApplicationStatus;
use App\Enums\HireConfirmedBy;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Application>
 */
class ApplicationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'job_posting_id' => JobPosting::factory()->open(),
            'candidate_profile_id' => CandidateProfile::factory(),
            'status' => ApplicationStatus::Pending,
            'cover_note' => fake()->optional()->sentence(12),
            'interview_request' => null,
        ];
    }

    public function status(ApplicationStatus $status): static
    {
        return $this->state(fn () => ['status' => $status]);
    }

    public function hired(?string $at = null, HireConfirmedBy $by = HireConfirmedBy::Employer): static
    {
        return $this->state(fn () => [
            'status' => ApplicationStatus::Hired,
            'hired_at' => $at ?? now(),
            'hire_confirmed_by' => $by,
        ])->afterCreating(fn (Application $application) => $application->recordHireSnapshot());
    }
}
