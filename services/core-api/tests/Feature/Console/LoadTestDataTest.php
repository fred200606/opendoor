<?php

namespace Tests\Feature\Console;

use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use Database\Seeders\AccommodationSeeder;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoadTestDataTest extends TestCase
{
    use RefreshDatabase;

    private string $tokens;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed([CategorySeeder::class, AccommodationSeeder::class]);
        $this->tokens = sys_get_temp_dir().'/opendoor-load-test-'.uniqid().'.csv';
    }

    protected function tearDown(): void
    {
        @unlink($this->tokens);
        parent::tearDown();
    }

    private function createData(): void
    {
        $this->artisan('load-test:data', ['--postings' => 24, '--candidates' => 3, '--tokens' => $this->tokens])->assertSuccessful();
    }

    public function test_creates_visible_postings_and_candidates_whose_tokens_search_in_match_mode(): void
    {
        $this->createData();

        $this->assertSame(10, Employer::whereNotNull('verified_at')->count());
        $this->assertSame(24, JobPosting::visible()->count());
        $this->assertSame(3, CandidateProfile::has('accommodations', '>=', 2)->count());

        $tokens = file($this->tokens, FILE_IGNORE_NEW_LINES);
        $this->assertCount(3, $tokens);
        $this->getJson('/api/job-postings?match=1&page=2', ['Authorization' => "Bearer {$tokens[0]}"])
            ->assertOk()
            ->assertJsonPath('meta.match_mode', true)
            ->assertJsonPath('meta.total', 24);
    }

    public function test_running_again_keeps_the_data_and_replaces_the_tokens(): void
    {
        $this->createData();
        $before = file($this->tokens, FILE_IGNORE_NEW_LINES);
        $titles = JobPosting::orderBy('id')->pluck('category_id', 'title');

        $this->createData();

        $this->assertSame(24, JobPosting::count());
        $this->assertSame(13, User::count());
        $this->assertEquals($titles, JobPosting::orderBy('id')->pluck('category_id', 'title'), 'same data on every run');
        $this->getJson('/api/me', ['Authorization' => "Bearer {$before[0]}"])->assertUnauthorized();
        $this->getJson('/api/me', ['Authorization' => 'Bearer '.file($this->tokens, FILE_IGNORE_NEW_LINES)[0]])->assertOk();
    }

    public function test_remove_deletes_everything_it_created_and_the_token_file(): void
    {
        $demo = User::factory()->candidate()->create();
        $this->createData();

        $this->artisan('load-test:data', ['--remove' => true, '--tokens' => $this->tokens])->assertSuccessful();

        $this->assertSame([$demo->id], User::pluck('id')->all());
        $this->assertSame(0, JobPosting::withTrashed()->count());
        $this->assertSame(0, Employer::count());
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertFileDoesNotExist($this->tokens);
    }

    public function test_remove_refuses_when_someone_applied_to_a_load_test_posting(): void
    {
        $this->createData();
        Application::factory()->for(JobPosting::first())->create();

        $this->artisan('load-test:data', ['--remove' => true, '--tokens' => $this->tokens])
            ->expectsOutputToContain('1 application(s) were made to load-test postings')
            ->assertFailed();
        $this->assertSame(24, JobPosting::count());
    }
}
