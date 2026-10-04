<?php

namespace Database\Factories;

use App\Enums\AccommodationGroup;
use App\Models\Accommodation;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Accommodation>
 */
class AccommodationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => ucfirst(fake()->unique()->words(3, true)),
            'group' => fake()->randomElement(AccommodationGroup::cases()),
            'description' => fake()->optional()->sentence(),
            'is_retired' => false,
        ];
    }

    public function retired(): static
    {
        return $this->state(fn () => ['is_retired' => true]);
    }
}
