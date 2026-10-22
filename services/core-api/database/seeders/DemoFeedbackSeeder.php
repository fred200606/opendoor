<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Enums\HiringParty;
use App\Enums\UserRole;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Feedback;
use App\Models\HiringReport;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Hired applications and feedback (run after DemoPostingSeeder and DemoCandidateSeeder).
 * Idempotent by email + posting. Each hire is a hiring report by the employer that the candidate
 * confirmed, starting on the day of the hire (Decision 2026-10-22b).
 *
 * - employer@: 3 responses, so the trust score is published (79%).
 * - employer2@: 2 responses (not published yet) and a hire of candidate2@ whose feedback window
 *   is open but unused: the 3rd response publishes the score (Postman T10, or try it in the UI).
 *
 * The former employees are seed-only accounts with a random password (nobody logs in as them).
 */
class DemoFeedbackSeeder extends Seeder
{
    /** @var list<array{employer: string, name: string, email: string, posting: string, hired_days_ago: int, ratings: array<string, string>|null}> */
    public const HIRES = [
        [
            'employer' => 'employer@opendoor.test', 'name' => 'Liza Mendoza', 'email' => 'former1@opendoor.test', 'posting' => 'Data Encoder', 'hired_days_ago' => 120,
            'ratings' => [
                'Wheelchair-accessible entrance' => 'delivered',
                'Accessible restroom' => 'delivered',
                'Written or captioned meetings' => 'partial',
                'Screen-reader-compatible work tools' => 'delivered',
            ],
        ],
        [
            'employer' => 'employer@opendoor.test', 'name' => 'Carlo Bautista', 'email' => 'former2@opendoor.test', 'posting' => 'Data Encoder', 'hired_days_ago' => 90,
            'ratings' => [
                'Wheelchair-accessible entrance' => 'delivered',
                'Accessible restroom' => 'delivered',
                'Written or captioned meetings' => 'delivered',
                'Screen-reader-compatible work tools' => 'partial',
            ],
        ],
        [
            'employer' => 'employer@opendoor.test', 'name' => 'Grace Ramos', 'email' => 'former3@opendoor.test', 'posting' => 'Customer Support Associate (Chat)', 'hired_days_ago' => 75,
            'ratings' => [
                'Hybrid work' => 'delivered',
                'Sign language interpreter' => 'not_delivered',
                'Written or captioned meetings' => 'delivered',
                'Flexible hours' => 'partial',
            ],
        ],
        [
            'employer' => 'employer2@opendoor.test', 'name' => 'Rosa Aquino', 'email' => 'former4@opendoor.test', 'posting' => 'Quality Control Assistant', 'hired_days_ago' => 140,
            'ratings' => [
                'Elevator or ground-floor workspace' => 'delivered',
                'Adjustable workstation' => 'not_delivered',
                'Written or captioned meetings' => 'delivered',
            ],
        ],
        [
            'employer' => 'employer2@opendoor.test', 'name' => 'Mark Santiago', 'email' => 'former5@opendoor.test', 'posting' => 'Quality Control Assistant', 'hired_days_ago' => 140,
            'ratings' => [
                'Elevator or ground-floor workspace' => 'delivered',
                'Adjustable workstation' => 'partial',
                'Written or captioned meetings' => 'delivered',
            ],
        ],
        // Demo candidate: hired 45 days ago, rating still to give (the 3rd response for employer2@).
        ['employer' => 'employer2@opendoor.test', 'name' => 'Juan Dela Cruz', 'email' => 'candidate2@opendoor.test', 'posting' => 'Quality Control Assistant', 'hired_days_ago' => 45, 'ratings' => null],
    ];

    public function run(): void
    {
        $accommodations = Accommodation::pluck('id', 'name');

        foreach (self::HIRES as $hire) {
            $employer = User::where('email', $hire['employer'])->first()?->employer;
            $posting = $employer?->jobPostings()->where('title', $hire['posting'])->first();
            $profile = $this->candidate($hire['name'], $hire['email']);
            if (! $posting || ! $profile) {
                continue;
            }

            $application = $this->hiredApplication($posting, $profile, $hire['hired_days_ago']);
            if ($hire['ratings'] !== null && ! $application->feedback()->exists()) {
                Feedback::submit(
                    $application,
                    collect($hire['ratings'])->mapWithKeys(fn ($rating, $name) => [$accommodations[$name] => $rating])->all(),
                );
            }
        }
    }

    /** Former employees are created here; demo candidates come from DemoUserSeeder. */
    private function candidate(string $name, string $email): ?CandidateProfile
    {
        $user = User::where('email', $email)->first();
        if (! $user && str_starts_with($email, 'former')) {
            $user = (new User)->forceFill([
                'name' => $name,
                'email' => $email,
                'password' => Str::random(40),
                'role' => UserRole::Candidate,
                'is_active' => true,
                'consented_at' => now(),
                'email_verified_at' => now(),
            ]);
            $user->save();
        }
        if (! $user) {
            return null;
        }

        $profile = CandidateProfile::firstOrNew(['user_id' => $user->id]);
        $profile->user_id = $user->id;
        $profile->save();

        return $profile;
    }

    private function hiredApplication(JobPosting $posting, CandidateProfile $profile, int $hiredDaysAgo): Application
    {
        $application = Application::firstOrNew(['job_posting_id' => $posting->id, 'candidate_profile_id' => $profile->id]);
        if ($application->exists) {
            return $application;
        }

        $hiredAt = now()->subDays($hiredDaysAgo)->setTime(10, 0);
        $application->forceFill([
            'job_posting_id' => $posting->id,
            'candidate_profile_id' => $profile->id,
            'status' => ApplicationStatus::Reviewed,
            'reviewed_at' => $hiredAt->copy()->subDays(10),
            'created_at' => $hiredAt->copy()->subDays(14),
            'updated_at' => $hiredAt,
        ])->save();
        HiringReport::recordConfirmed($application, HiringParty::Employer, $hiredAt, $hiredAt->toDateString());

        return $application;
    }
}
