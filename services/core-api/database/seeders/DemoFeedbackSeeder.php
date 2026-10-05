<?php

namespace Database\Seeders;

use App\Enums\ApplicationStatus;
use App\Enums\HireConfirmedBy;
use App\Enums\UserRole;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Hired applications and feedback so the first demo employer has a published trust score
 * (run after DemoPostingSeeder and DemoCandidateSeeder). Idempotent by email + posting.
 *
 * The three former employees are seed-only accounts with a random password (nobody logs in as
 * them). candidate2@ gets a hire whose feedback window is open but not used yet, so the form can
 * be tried live.
 */
class DemoFeedbackSeeder extends Seeder
{
    private const EMPLOYER = 'employer@opendoor.test';

    /** @var list<array{name: string, email: string, posting: string, hired_days_ago: int, ratings: array<string, string>|null}> */
    public const HIRES = [
        [
            'name' => 'Liza Mendoza', 'email' => 'former1@opendoor.test', 'posting' => 'Data Encoder', 'hired_days_ago' => 120,
            'ratings' => [
                'Wheelchair-accessible entrance' => 'delivered',
                'Accessible restroom' => 'delivered',
                'Written or captioned meetings' => 'partial',
                'Screen-reader-compatible work tools' => 'delivered',
            ],
        ],
        [
            'name' => 'Carlo Bautista', 'email' => 'former2@opendoor.test', 'posting' => 'Data Encoder', 'hired_days_ago' => 90,
            'ratings' => [
                'Wheelchair-accessible entrance' => 'delivered',
                'Accessible restroom' => 'delivered',
                'Written or captioned meetings' => 'delivered',
                'Screen-reader-compatible work tools' => 'partial',
            ],
        ],
        [
            'name' => 'Grace Ramos', 'email' => 'former3@opendoor.test', 'posting' => 'Customer Support Associate (Chat)', 'hired_days_ago' => 75,
            'ratings' => [
                'Hybrid work' => 'delivered',
                'Sign language interpreter' => 'not_delivered',
                'Written or captioned meetings' => 'delivered',
                'Flexible hours' => 'partial',
            ],
        ],
        // Demo candidate: hired 45 days ago, rating still to give.
        ['name' => 'Juan Dela Cruz', 'email' => 'candidate2@opendoor.test', 'posting' => 'Customer Support Associate (Chat)', 'hired_days_ago' => 45, 'ratings' => null],
    ];

    public function run(): void
    {
        $employer = User::where('email', self::EMPLOYER)->first()?->employer;
        if (! $employer) {
            return;
        }
        $accommodations = Accommodation::pluck('id', 'name');

        foreach (self::HIRES as $hire) {
            $posting = $employer->jobPostings()->where('title', $hire['posting'])->first();
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
            'status' => ApplicationStatus::Hired,
            'hired_at' => $hiredAt,
            'hire_confirmed_by' => HireConfirmedBy::Employer,
            'created_at' => $hiredAt->copy()->subDays(14),
            'updated_at' => $hiredAt,
        ])->save();
        $application->recordHireSnapshot();

        return $application;
    }
}
