<?php

namespace Database\Factories;

use App\Enums\ApplicationStatus;
use App\Enums\HiringParty;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\HiringReport;
use App\Models\JobPosting;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

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

    /**
     * Hired through a hiring report by $by that the other party confirmed at $at. The start date is
     * the calendar day of $at (Manila) unless given, so the rating opens 30 days after it.
     */
    public function hired(?string $at = null, HiringParty $by = HiringParty::Employer, ?string $startDate = null): static
    {
        $confirmedAt = Carbon::parse($at ?? now());

        return $this->state(fn () => ['status' => ApplicationStatus::Reviewed])
            ->afterCreating(fn (Application $application) => HiringReport::recordConfirmed(
                $application, $by, $confirmedAt, $startDate ?? $confirmedAt->copy()->timezone('Asia/Manila')->toDateString(),
            ));
    }
}
