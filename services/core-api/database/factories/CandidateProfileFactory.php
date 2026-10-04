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
            'location_psgc' => null,
            'location_label' => 'Quezon City, Metro Manila',
            'disability_type' => null,
            'show_disability' => false,
        ];
    }

    /** Attaches the given accommodations as needs after creating the profile. */
    public function needing(Accommodation ...$accommodations): static
    {
        return $this->afterCreating(fn (CandidateProfile $profile) => $profile->accommodations()->attach(collect($accommodations)->pluck('id')));
    }
}
