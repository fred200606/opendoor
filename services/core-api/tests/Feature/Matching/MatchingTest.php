<?php

namespace Tests\Feature\Matching;

use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Models\Skill;
use App\Services\MatchingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Decision 2026-10-21: one match score from skills, location, qualifications, preferences and needs. */
class MatchingTest extends TestCase
{
    use RefreshDatabase;

    private const QC = '1381300000';

    private const PASIG = '1381200000';

    private const CEBU = '0730600000';

    private CandidateProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        Skill::factory()->create(['name' => 'Microsoft Excel', 'aliases' => ['Excel']]);
        $this->profile = CandidateProfile::factory()->create([
            'skills' => ['Excel', 'Data entry', 'Typing'],
            'education_level' => 'senior_high',
            'experience_years' => 2,
            'preferred_work_setups' => ['onsite', 'hybrid'],
            'preferred_employment_types' => ['full_time'],
            'location_psgc' => self::QC,
        ]);
        $this->point($this->profile, 14.6760, 121.0437);
        Sanctum::actingAs($this->profile->user);
    }

    private function point(CandidateProfile|JobPosting $model, float $lat, float $lon, ?string $province = null): void
    {
        $model->forceFill(['location_lat' => $lat, 'location_lon' => $lon, 'location_province_psgc' => $province, 'location_checked_at' => now()])->saveQuietly();
    }

    /** @param  array<string, mixed>  $attributes */
    private function posting(string $title, array $attributes = []): JobPosting
    {
        return JobPosting::factory()->open()->create([
            'title' => $title,
            'skills' => ['Microsoft Excel', 'Data entry'],
            'location_psgc' => self::QC,
            ...$attributes,
        ]);
    }

    private function match(JobPosting $posting): array
    {
        return $this->getJson("/api/job-postings/{$posting->id}")->assertOk()->json('match');
    }

    /** @return list<string> */
    private function titles(TestResponse $response): array
    {
        return array_column($response->json('data'), 'title');
    }

    public function test_a_posting_that_fits_in_every_way_is_a_strong_match(): void
    {
        $posting = $this->posting('Data Encoder', ['education_level' => 'high_school', 'experience_years' => 1]);
        $this->point($posting, 14.6760, 121.0437);

        $this->assertSame([
            'score' => 100,
            'label' => 'strong',
            'met' => 0,
            'total' => 0,
            'missing' => [],
            'skills' => ['matched' => ['Microsoft Excel', 'Data entry'], 'missing' => []],
            'location' => ['tier' => 'same_city', 'distance_km' => 0],
            'education' => ['required' => 'high_school', 'met' => true],
            'experience' => ['required_years' => 1, 'met' => true],
            'preferences' => ['work_setup' => true, 'employment_type' => true],
        ], $this->match($posting));
    }

    public function test_each_part_counts_with_its_weight(): void
    {
        // Skills ½ (40 × 0.5 = 20), same region 0.3 (20 × 0.3 = 6), education not met, experience met
        // (15 × 0.5 = 7.5), part-time not preferred (10 × 0.5 = 5) → 38.5 of 85 → 45 "fair".
        $posting = $this->posting('Clerk', [
            'skills' => ['Microsoft Excel', 'Bookkeeping'],
            'location_psgc' => self::PASIG,
            'education_level' => 'college',
            'experience_years' => 1,
            'employment_type' => 'part_time',
        ]);

        $match = $this->match($posting);

        $this->assertSame(45, $match['score']);
        $this->assertSame('fair', $match['label']);
        $this->assertSame(['matched' => ['Microsoft Excel'], 'missing' => ['Bookkeeping']], $match['skills']);
        $this->assertSame('same_region', $match['location']['tier']);
        $this->assertSame(['required' => 'college', 'met' => false], $match['education']);
        $this->assertSame(['work_setup' => true, 'employment_type' => false], $match['preferences']);
    }

    public function test_location_tiers_remote_and_distance(): void
    {
        $remote = $this->posting('Remote', ['location_psgc' => self::CEBU, 'work_setup' => 'remote']);
        $cebu = $this->posting('Cebu', ['location_psgc' => self::CEBU]);
        $pasig = $this->posting('Pasig', ['location_psgc' => self::PASIG]);
        $this->point($pasig, 14.5764, 121.0851);
        $noPlace = $this->posting('Somewhere', ['location_psgc' => null]);

        $this->assertSame(['tier' => 'remote', 'distance_km' => null], $this->match($remote)['location']);
        $this->assertSame('farther', $this->match($cebu)['location']['tier']);
        $this->assertSame(['tier' => 'same_region', 'distance_km' => 12], $this->match($pasig)['location']);
        $this->assertSame('unknown', $this->match($noPlace)['location']['tier']);
        // Remote counts as a full location match; an unknown place is left out of the score.
        $this->assertGreaterThan($this->match($cebu)['score'], $this->match($remote)['score']);
    }

    public function test_cities_of_one_province_are_the_same_province(): void
    {
        $this->profile->update(['location_psgc' => '0402108000']);
        $this->point($this->profile, 14.3294, 120.9367, '0402100000');
        $bacoor = $this->posting('Bacoor', ['location_psgc' => '0402103000']);
        $this->point($bacoor, 14.4624, 120.9645, '0402100000');
        // Without an Insights answer the code prefix decides (same here).
        $imus = $this->posting('Imus', ['location_psgc' => '0402109000']);

        $this->assertSame(['tier' => 'same_province', 'distance_km' => 15], $this->match($bacoor)['location']);
        $this->assertSame('same_province', $this->match($imus)['location']['tier']);
    }

    public function test_recommended_for_me_ranks_by_score_and_pages_the_ranking(): void
    {
        $this->posting('Weak', ['skills' => ['Welding'], 'location_psgc' => self::CEBU, 'employment_type' => 'contract']);
        $this->posting('Strong');
        for ($i = 1; $i <= 12; $i++) {
            $this->posting("Medium {$i}", ['skills' => ['Microsoft Excel', 'Welding'], 'created_at' => now()->subDays($i)]);
        }

        $first = $this->getJson('/api/job-postings?match=1')->assertOk()->assertJsonPath('meta.match_mode', true)->assertJsonPath('meta.total', 14);
        $this->assertSame(['Strong', 'Medium 1', 'Medium 2'], array_slice($this->titles($first), 0, 3));
        $this->assertCount(12, $first->json('data'));

        $second = $this->getJson('/api/job-postings?match=1&page=2')->assertOk();
        $this->assertSame(['Medium 12', 'Weak'], $this->titles($second));
        $this->assertStringContainsString('match=1', $second->json('links.prev'));
    }

    public function test_the_distance_filter_keeps_nearby_and_remote_jobs(): void
    {
        $near = $this->posting('Pasig, 12 km');
        $this->point($near, 14.5764, 121.0851);
        $far = $this->posting('Cebu, 570 km', ['location_psgc' => self::CEBU]);
        $this->point($far, 10.3157, 123.8854);
        $this->posting('Remote, Cebu', ['location_psgc' => self::CEBU, 'work_setup' => 'remote']);
        $this->posting('No point yet');

        $response = $this->getJson('/api/job-postings?distance=25&sort=newest')->assertOk()->assertJsonPath('meta.distance', 25);
        $this->assertEqualsCanonicalizing(['Pasig, 12 km', 'Remote, Cebu'], $this->titles($response));

        $this->assertEqualsCanonicalizing(['Remote, Cebu'], $this->titles($this->getJson('/api/job-postings?distance=10')));
    }

    public function test_without_a_point_or_as_a_guest_the_distance_is_ignored(): void
    {
        $this->posting('One');
        $this->profile->forceFill(['location_lat' => null, 'location_lon' => null])->saveQuietly();

        $this->getJson('/api/job-postings?distance=10')->assertOk()->assertJsonPath('meta.distance', null)->assertJsonPath('meta.total', 1);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/job-postings?distance=10')->assertOk()->assertJsonPath('meta.distance', null)->assertJsonPath('meta.total', 1);
    }

    public function test_work_setup_filter_for_everyone(): void
    {
        $this->posting('On-site');
        $this->posting('Hybrid', ['work_setup' => 'hybrid']);
        $this->posting('Remote', ['work_setup' => 'remote']);
        $this->app['auth']->forgetGuards();

        $this->assertEqualsCanonicalizing(['Hybrid', 'Remote'], $this->titles($this->getJson('/api/job-postings?work_setup[]=remote&work_setup[]=hybrid')));
    }

    public function test_needs_still_count_and_saved_jobs_show_the_match(): void
    {
        $ramp = Accommodation::factory()->create(['name' => 'Wheelchair-accessible entrance']);
        $this->profile->accommodations()->attach($ramp);
        $posting = $this->posting('Data Encoder');
        $posting->accommodations()->attach($ramp->id, ['note' => null]);

        $this->postJson("/api/candidate/saved-jobs/{$posting->id}")->assertCreated()->assertJsonPath('match.met', 1);
        $this->getJson('/api/candidate/saved-jobs')->assertJsonPath('data.0.match.total', 1)->assertJsonPath('data.0.match.score', 100);
    }

    public function test_labels(): void
    {
        $this->assertSame(['strong', 'strong', 'good', 'fair', 'low', 'low'], array_map(MatchingService::label(...), [100, 80, 60, 40, 39, 0]));
    }
}
