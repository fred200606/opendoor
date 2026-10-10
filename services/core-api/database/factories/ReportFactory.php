<?php

namespace Database\Factories;

use App\Enums\ReportStatus;
use App\Models\JobPosting;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Report>
 */
class ReportFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'reporter_id' => User::factory()->candidate(),
            'job_posting_id' => JobPosting::factory()->open(),
            'reason' => fake()->sentence(10),
            'status' => ReportStatus::Open,
        ];
    }

    public function resolved(ReportStatus $status = ReportStatus::Dismissed, ?string $note = null): static
    {
        return $this->state(fn () => [
            'status' => $status,
            'note' => $note,
            'resolved_by' => User::factory()->admin(),
            'resolved_at' => now(),
        ]);
    }
}
