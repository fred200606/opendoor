<?php

namespace Tests\Feature\Dashboards;

use App\Enums\ApplicationStatus;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** The admin dashboard charts (Decision 2026-10-22d): aggregates only. */
class AdminAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Thursday 22 Oct 2026, Manila: the current week starts Monday 19 Oct.
        Carbon::setTestNow(Carbon::parse('2026-10-22 10:00', 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function analytics(): TestResponse
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        return $this->getJson('/api/admin/dashboard')->assertOk();
    }

    public function test_weeks_count_applications_hires_and_new_accounts_per_manila_week(): void
    {
        $posting = JobPosting::factory()->open()->create();
        Application::factory()->for($posting)->create(); // this week
        Application::factory()->for($posting)->create(['created_at' => '2026-10-12 09:00']); // last week (Mon)
        Application::factory()->for($posting)->create(['created_at' => '2026-10-18 23:30']); // Sunday: still last week
        Application::factory()->for($posting)->create(['created_at' => '2026-07-01 09:00']); // before the 12 weeks
        Application::factory()->for($posting)->hired('2026-10-13 10:00')->create(['created_at' => '2026-09-01 09:00']);
        $deleted = JobPosting::factory()->open()->create();
        Application::factory()->for($deleted)->create();
        $deleted->delete();
        User::factory()->candidate()->create(['created_at' => '2026-09-02 09:00']);

        $weeks = $this->analytics()->json('analytics.weeks');

        $this->assertCount(12, $weeks);
        $this->assertSame('2026-08-03', $weeks[0]['week_start']);
        $this->assertSame('2026-10-19', $weeks[11]['week_start']);
        $this->assertSame(['week_start' => '2026-10-12', 'applications' => 2, 'hires' => 1, 'new_accounts' => 0], $weeks[10]);
        $this->assertSame(1, $weeks[11]['applications']);
        $this->assertSame(1, collect($weeks)->firstWhere('week_start', '2026-08-31')['applications']);
        $this->assertSame(1, collect($weeks)->firstWhere('week_start', '2026-08-31')['new_accounts']);
        // Everyone else (job seekers and employers made by the factories) joined this week; admins are not counted.
        $joined = User::query()->whereIn('role', ['candidate', 'employer'])->count() - 1;
        $this->assertSame($joined, $weeks[11]['new_accounts']);
    }

    public function test_the_funnel_counts_skipped_stages_as_passed(): void
    {
        $posting = JobPosting::factory()->open()->create();
        $make = fn (ApplicationStatus $status, array $dates = []) => Application::factory()->for($posting)->status($status)->create($dates);
        $make(ApplicationStatus::Pending);
        $make(ApplicationStatus::Reviewed, ['reviewed_at' => now()]);
        $make(ApplicationStatus::Shortlisted); // skipped the review
        $make(ApplicationStatus::Contacted, ['reviewed_at' => now(), 'contacted_at' => now()]);
        $make(ApplicationStatus::Rejected, ['reviewed_at' => now(), 'shortlisted_at' => now()]);
        $make(ApplicationStatus::Withdrawn);
        Application::factory()->for($posting)->hired()->create();

        $this->assertSame(
            ['submitted' => 7, 'reviewed' => 5, 'shortlisted' => 4, 'contacted' => 2, 'hired' => 1],
            $this->analytics()->json('analytics.funnel'),
        );
    }

    public function test_needs_are_compared_with_what_open_jobs_offer(): void
    {
        [$ramp, $interpreter, $captions] = [
            Accommodation::factory()->create(['name' => 'Ramp']),
            Accommodation::factory()->create(['name' => 'Interpreter']),
            Accommodation::factory()->create(['name' => 'Captions']),
        ];
        CandidateProfile::factory()->needing($ramp, $interpreter)->create();
        CandidateProfile::factory()->needing($ramp, $interpreter, $captions)->create();
        CandidateProfile::factory()->needing($ramp)->create();
        CandidateProfile::factory()->create(); // no needs, still a job seeker
        JobPosting::factory()->open()->withAccommodations($ramp)->create();
        JobPosting::factory()->open()->withAccommodations($ramp, $captions)->create();
        JobPosting::factory()->withAccommodations($interpreter)->create(); // a draft: not open

        $this->assertSame([
            'job_seekers' => 4,
            'open_jobs' => 2,
            'top' => [
                ['accommodation_id' => $ramp->id, 'name' => 'Ramp', 'job_seekers' => 3, 'open_jobs' => 2],
                ['accommodation_id' => $interpreter->id, 'name' => 'Interpreter', 'job_seekers' => 2, 'open_jobs' => 0],
                ['accommodation_id' => $captions->id, 'name' => 'Captions', 'job_seekers' => 1, 'open_jobs' => 1],
            ],
        ], $this->analytics()->json('analytics.needs'));
    }

    public function test_delivery_counts_the_rated_items_of_visible_responses(): void
    {
        [$ramp, $captions] = [Accommodation::factory()->create(), Accommodation::factory()->create()];
        $posting = JobPosting::factory()->open()->withAccommodations($ramp, $captions)->create();
        $hire = fn () => Application::factory()->for($posting)->hired()->create();
        Feedback::submit($hire(), [$ramp->id => 'delivered', $captions->id => 'partial']);
        Feedback::submit($hire(), [$ramp->id => 'delivered', $captions->id => 'not_delivered']);
        Feedback::submit($hire(), [$ramp->id => 'not_delivered'])->forceFill(['is_hidden' => true])->save();

        $this->assertSame(['delivered' => 2, 'partial' => 1, 'not_delivered' => 1], $this->analytics()->json('analytics.delivery'));
    }

    public function test_an_empty_platform_gives_zeros(): void
    {
        $analytics = $this->analytics()->json('analytics');

        $this->assertSame([0], array_values(array_unique(array_merge(...array_map(fn ($week) => [$week['applications'], $week['hires'], $week['new_accounts']], $analytics['weeks'])))));
        $this->assertSame(['submitted' => 0, 'reviewed' => 0, 'shortlisted' => 0, 'contacted' => 0, 'hired' => 0], $analytics['funnel']);
        $this->assertSame(['job_seekers' => 0, 'open_jobs' => 0, 'top' => []], $analytics['needs']);
        $this->assertSame(['delivered' => 0, 'partial' => 0, 'not_delivered' => 0], $analytics['delivery']);
    }
}
