<?php

namespace Database\Factories;

use App\Models\Employer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Employer>
 */
class EmployerFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $registryType = fake()->randomElement(['DTI', 'SEC']);

        return [
            'user_id' => User::factory()->employer(),
            'company_name' => fake()->company(),
            'business_reg_no' => $registryType === 'DTI' ? (string) fake()->unique()->numerify('########') : fake()->unique()->bothify('CS20########'),
            'registry_type' => $registryType,
            'industry' => fake()->randomElement(['Information Technology', 'Business Process Outsourcing', 'Food Manufacturing', 'Retail']),
            'address' => fake()->streetAddress(),
            'location_psgc' => null,
            'location_label' => 'Quezon City, Metro Manila',
            'description' => fake()->optional()->paragraph(),
        ];
    }

    public function verified(): static
    {
        return $this->state(fn () => ['verified_at' => now()]);
    }

    public function rejected(string $reason = 'Registration number not found.'): static
    {
        return $this->state(fn () => ['verification_rejected_reason' => $reason]);
    }

    /** A published trust score (≥ 3 responses). */
    public function withTrustScore(int $score = 86, int $responses = 5): static
    {
        return $this->state(fn () => ['trust_score' => $score, 'feedback_count' => $responses]);
    }
}
