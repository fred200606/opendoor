<?php

namespace Tests\Feature\Dashboards;

use App\Enums\ApplicationStatus;
use App\Enums\JobPostingStatus;
use App\Enums\ReportStatus;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M8: candidate, employer and admin dashboards (zero-filled counts that agree with the lists). */
class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private const NO_APPLICATIONS = ['pending' => 0, 'reviewed' => 0, 'hired' => 0, 'rejected' => 0, 'withdrawn' => 0];

    private const NO_POSTINGS = ['draft' => 0, 'open' => 0, 'closed' => 0];

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_candidate_dashboard_counts_applications_matches_and_feedback_due(): void
    {
        Carbon::setTestNow('2026-10-10 09:00:00');
        [$ramp, $interpreter, $captions] = Accommodation::factory()->count(3)->create()->all();
        $profile = CandidateProfile::factory()->needing($ramp, $interpreter)->create();

        // Visible postings offering every need count; partial, unpublished and deleted ones do not.
        JobPosting::factory()->open()->withAccommodations($ramp, $interpreter)->create();
        JobPosting::factory()->open()->withAccommodations($ramp, $interpreter, $captions)->create();
        JobPosting::factory()->open()->withAccommodations($ramp)->create();
        JobPosting::factory()->open()->unverifiedEmployer()->withAccommodations($ramp, $interpreter)->create();
        JobPosting::factory()->open()->withAccommodations($ramp, $interpreter)->create()->delete();

        $mine = Application::factory()->for($profile);
        $mine->create();
        $mine->status(ApplicationStatus::Withdrawn)->create();
        $recent = $mine->hired('2026-10-05 15:00:00')->create();
        $older = $mine->hired('2026-09-01 10:00:00')->create();
        $rated = $mine->hired('2026-08-01 10:00:00')->create();
        Feedback::submit($rated, []);
        Application::factory()->create(); // someone else's

        Sanctum::actingAs($profile->user);
        $this->getJson('/api/candidate/dashboard')
            ->assertOk()
            ->assertExactJson([
                'applications' => ['pending' => 1, 'reviewed' => 0, 'hired' => 3, 'rejected' => 0, 'withdrawn' => 1],
                'needs_count' => 2,
                'matching_jobs' => 2,
                'feedback_due' => [
                    [
                        'application_id' => $older->id,
                        'job_title' => $older->jobPosting->title,
                        'company_name' => $older->jobPosting->employer->company_name,
                        'opens_on' => '2026-10-01',
                        'is_open' => true,
                    ],
                    [
                        'application_id' => $recent->id,
                        'job_title' => $recent->jobPosting->title,
                        'company_name' => $recent->jobPosting->employer->company_name,
                        'opens_on' => '2026-11-04',
                        'is_open' => false,
                    ],
                ],
            ]);
    }

    public function test_candidate_without_profile_or_needs_gets_zeros(): void
    {
        JobPosting::factory()->open()->create();
        Sanctum::actingAs(User::factory()->candidate()->create());

        $this->getJson('/api/candidate/dashboard')
            ->assertOk()
            ->assertExactJson(['applications' => self::NO_APPLICATIONS, 'needs_count' => 0, 'matching_jobs' => 0, 'feedback_due' => []]);

        Sanctum::actingAs(CandidateProfile::factory()->create()->user);
        $this->getJson('/api/candidate/dashboard')->assertJsonPath('needs_count', 0)->assertJsonPath('matching_jobs', 0);
    }

    public function test_employer_dashboard_counts_own_postings_and_applicants(): void
    {
        $employer = Employer::factory()->verified()->withTrustScore(86, 5)->create();
        $own = JobPosting::factory()->for($employer);
        $own->create();
        $open = $own->open()->create();
        $own->open()->create();
        $own->closed()->create();
        $deleted = $own->open()->create();

        Application::factory()->for($open)->create();
        Application::factory()->for($open)->status(ApplicationStatus::Reviewed)->create();
        Application::factory()->for($deleted)->hired()->create();
        $deleted->delete();
        Application::factory()->create(); // another employer's posting

        Sanctum::actingAs($employer->user);
        $this->getJson('/api/employer/dashboard')
            ->assertOk()
            ->assertExactJson([
                'company' => ['exists' => true, 'verified' => true, 'verification_rejected_reason' => null],
                'postings' => ['draft' => 1, 'open' => 2, 'closed' => 1],
                // Applicants include those of the deleted posting (as in the applicants list).
                'applications' => ['pending' => 1, 'reviewed' => 1, 'hired' => 1, 'rejected' => 0, 'withdrawn' => 0],
                'trust_score' => ['published' => true, 'score' => 86, 'based_on' => 5],
            ]);
    }

    public function test_employer_without_company_or_with_a_rejected_one(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());
        $this->getJson('/api/employer/dashboard')
            ->assertOk()
            ->assertExactJson([
                'company' => ['exists' => false, 'verified' => false, 'verification_rejected_reason' => null],
                'postings' => self::NO_POSTINGS,
                'applications' => self::NO_APPLICATIONS,
                'trust_score' => ['published' => false, 'score' => null, 'based_on' => 0],
            ]);

        $rejected = Employer::factory()->rejected('Number not found.')->withTrustScore(90, 2)->create();
        Sanctum::actingAs($rejected->user);
        $this->getJson('/api/employer/dashboard')
            ->assertJsonPath('company', ['exists' => true, 'verified' => false, 'verification_rejected_reason' => 'Number not found.'])
            ->assertJsonPath('trust_score', ['published' => false, 'score' => null, 'based_on' => 2]);
    }

    public function test_admin_dashboard_summarizes_the_platform(): void
    {
        $admin = User::factory()->admin()->create();
        $employer = Employer::factory()->verified()->create();
        Employer::factory()->count(2)->create(); // waiting for verification
        Employer::factory()->rejected()->create();
        Employer::factory()->verified()->withTrustScore(80, 3)->create();
        Employer::factory()->verified()->withTrustScore(90, 2)->create(); // not published yet

        $own = JobPosting::factory()->for($employer);
        $own->create();
        $open = $own->open()->create();
        $closed = $own->closed()->create();
        $deleted = $own->open()->create();

        $profile = CandidateProfile::factory()->create();
        User::factory()->candidate()->suspended()->create();
        Application::factory()->for($open)->for(CandidateProfile::factory())->create();
        $hired = Application::factory()->for($open)->for($profile)->hired(now()->subDays(40)->toDateTimeString())->create();
        $hiredToo = Application::factory()->for($closed)->for($profile)->hired(now()->subDays(40)->toDateTimeString())->create();
        Application::factory()->for($deleted)->for($profile)->create();
        $deleted->delete();

        Feedback::submit($hired, []);
        Feedback::submit($hiredToo, [])->forceFill(['is_hidden' => true])->save();

        $report = ['reporter_id' => $profile->user_id, 'job_posting_id' => $open->id];
        Report::factory()->count(2)->create($report);
        Report::factory()->create([...$report, 'status' => ReportStatus::Dismissed, 'resolved_by' => $admin->id, 'resolved_at' => now()]);

        Sanctum::actingAs($admin);
        $this->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertExactJson([
                'users' => ['candidate' => 3, 'employer' => 6, 'admin' => 1, 'suspended' => 1],
                'postings' => ['draft' => 1, 'open' => 1, 'closed' => 1],
                'applications' => ['pending' => 1, 'reviewed' => 0, 'hired' => 2, 'rejected' => 0, 'withdrawn' => 0],
                'verification_queue' => 2,
                'open_reports' => 2,
                'feedback' => ['responses' => 2, 'hidden' => 1],
                'published_trust_scores' => 1,
            ]);
    }

    public function test_each_dashboard_belongs_to_its_role(): void
    {
        $this->getJson('/api/candidate/dashboard')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->employer()->create());
        $this->getJson('/api/candidate/dashboard')->assertForbidden();
        $this->getJson('/api/admin/dashboard')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');

        Sanctum::actingAs(User::factory()->candidate()->create());
        $this->getJson('/api/employer/dashboard')->assertForbidden();

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson('/api/candidate/dashboard')->assertForbidden();
    }

    public function test_status_lists_cover_every_enum_case(): void
    {
        $this->assertSame(array_keys(self::NO_APPLICATIONS), array_column(ApplicationStatus::cases(), 'value'));
        $this->assertSame(array_keys(self::NO_POSTINGS), array_column(JobPostingStatus::cases(), 'value'));
    }
}
