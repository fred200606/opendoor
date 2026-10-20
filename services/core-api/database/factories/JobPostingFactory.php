<?php

namespace Database\Factories;

use App\Enums\JobPostingStatus;
use App\Models\Accommodation;
use App\Models\Category;
use App\Models\Employer;
use App\Models\JobPosting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<JobPosting>
 */
class JobPostingFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            // Verified: only a verified company's open postings are visible (Decision 2026-10-21).
            'employer_id' => Employer::factory()->verified(),
            'category_id' => Category::factory(),
            'title' => fake()->jobTitle(),
            'description' => fake()->paragraphs(2, true),
            'address' => fake()->streetAddress(),
            'location_psgc' => null,
            'location_label' => 'Quezon City, Metro Manila',
            // Fixed, not random: they count in the match score (Decision 2026-10-21).
            'employment_type' => 'full_time',
            'work_setup' => 'onsite',
            'interview_format' => 'online',
            'status' => JobPostingStatus::Draft,
            'closes_at' => now()->addMonth()->toDateString(),
            'is_approved' => false,
        ];
    }

    /** Open and approved – visible in search. */
    public function open(): static
    {
        return $this->state(fn () => ['status' => JobPostingStatus::Open, 'is_approved' => true]);
    }

    public function closed(): static
    {
        return $this->state(fn () => ['status' => JobPostingStatus::Closed, 'is_approved' => true]);
    }

    /** From a company that is not verified (yet): hidden even when open (Decision 2026-10-21). */
    public function unverifiedEmployer(): static
    {
        return $this->state(fn () => ['employer_id' => Employer::factory()]);
    }

    /** Attaches the given accommodations (without notes) after creating the posting. */
    public function withAccommodations(Accommodation ...$accommodations): static
    {
        return $this->afterCreating(function (JobPosting $posting) use ($accommodations) {
            $posting->accommodations()->attach(collect($accommodations)->mapWithKeys(fn ($a) => [$a->id => ['note' => null]])->all());
        });
    }
}
