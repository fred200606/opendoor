<?php

namespace Database\Factories;

use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CandidateProfile>
 */
class CandidateProfileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory()->candidate(),
            'headline' => fake()->jobTitle(),
            'skills' => fake()->randomElements(['Excel', 'Typing', 'Customer service', 'Filipino Sign Language', 'HTML', 'Bookkeeping'], 3),
            'experience' => fake()->sentence(12),
            // Complete for matching (Decision 2026-10-21); see incomplete().
            'education_level' => 'college',
            'experience_years' => 2,
            'preferred_work_setups' => ['onsite', 'hybrid', 'remote'],
            'preferred_employment_types' => ['full_time', 'part_time'],
            'location_psgc' => '1381300000',
            'location_label' => 'Quezon City, Metro Manila',
            'disability_type' => null,
            'show_disability' => false,
        ];
    }

    /** Fresh from sign-up: nothing that matching needs is filled in. */
    public function incomplete(): static
    {
        return $this->state(fn () => [
            'skills' => null,
            'education_level' => null,
            'experience_years' => null,
            'preferred_work_setups' => null,
            'preferred_employment_types' => null,
            'location_psgc' => null,
            'location_label' => null,
        ]);
    }

    /** Attaches the given accommodations as needs after creating the profile. */
    public function needing(Accommodation ...$accommodations): static
    {
        return $this->afterCreating(fn (CandidateProfile $profile) => $profile->accommodations()->attach(collect($accommodations)->pluck('id')));
    }
}
