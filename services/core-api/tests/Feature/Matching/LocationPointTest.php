<?php

namespace Tests\Feature\Matching;

use App\Models\CandidateProfile;
use App\Models\JobPosting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Decision 2026-10-21: city centre points from the Insights Service for matching by place. */
class LocationPointTest extends TestCase
{
    use RefreshDatabase;

    private const QC = '1381300000';

    private const PLACE = [
        'code' => self::QC, 'city' => 'Quezon City', 'province' => null, 'region' => 'National Capital Region (NCR)',
        'province_code' => null, 'region_code' => '1300000000', 'lat' => 14.6507, 'lon' => 121.0495, 'precision' => 'city',
    ];

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.insights.url' => 'http://insights.test', 'services.insights.key' => 'test-service-key']);
        Http::preventStrayRequests();
    }

    public function test_saving_a_city_looks_up_its_point_with_the_service_key(): void
    {
        Http::fake(['insights.test/internal/places/'.self::QC => Http::response(self::PLACE)]);

        $profile = CandidateProfile::factory()->create(['location_psgc' => self::QC]);

        $profile->refresh();
        $this->assertSame(14.6507, $profile->location_lat);
        $this->assertSame(121.0495, $profile->location_lon);
        $this->assertNull($profile->location_province_psgc);
        $this->assertNotNull($profile->location_checked_at);
        Http::assertSent(fn (Request $request) => $request->hasHeader('X-Service-Key', 'test-service-key'));
    }

    public function test_changing_the_city_replaces_the_point_and_a_province_is_kept(): void
    {
        Http::fake([
            'insights.test/internal/places/'.self::QC => Http::response(self::PLACE),
            'insights.test/internal/places/0730600000' => Http::response([...self::PLACE, 'code' => '0730600000', 'province_code' => '0702200000', 'region_code' => '0700000000', 'lat' => 10.3157, 'lon' => 123.8854]),
        ]);
        $posting = JobPosting::factory()->create(['location_psgc' => self::QC]);

        $posting->update(['location_psgc' => '0730600000', 'title' => 'Moved']);

        $posting->refresh();
        $this->assertSame([10.3157, 123.8854, '0702200000'], [$posting->location_lat, $posting->location_lon, $posting->location_province_psgc]);
        $posting->update(['title' => 'Renamed']);
        Http::assertSentCount(2);
    }

    public function test_insights_down_never_blocks_saving_and_the_command_tries_again(): void
    {
        Http::fake(['insights.test/*' => Http::sequence()->pushStatus(503)->push(self::PLACE)]);

        $profile = CandidateProfile::factory()->create(['location_psgc' => self::QC]);
        $this->assertNull($profile->fresh()->location_lat);
        $this->assertNull($profile->fresh()->location_checked_at);

        $this->artisan('locations:resolve')->expectsOutput('Found the centre point of 1 place(s).')->assertSuccessful();
        $this->assertSame(14.6507, $profile->fresh()->location_lat);

        // Nothing left to do: no further request.
        $this->artisan('locations:resolve')->expectsOutput('Found the centre point of 0 place(s).');
        Http::assertSentCount(2);
    }

    public function test_an_unknown_code_is_not_asked_again_for_a_day(): void
    {
        Http::fake(['insights.test/*' => Http::response(['error' => ['code' => 'NOT_FOUND']], 404)]);
        $profile = CandidateProfile::factory()->create(['location_psgc' => '1389999000']);

        $this->assertNotNull($profile->fresh()->location_checked_at);
        $this->artisan('locations:resolve')->assertSuccessful();
        Http::assertSentCount(1);

        $this->travel(25)->hours();
        $this->artisan('locations:resolve')->assertSuccessful();
        Http::assertSentCount(2);
    }

    public function test_without_an_insights_url_nothing_is_asked(): void
    {
        config(['services.insights.url' => '']);
        Http::fake();

        CandidateProfile::factory()->create(['location_psgc' => self::QC]);
        $this->artisan('locations:resolve')->expectsOutput('Place lookups are off (INSIGHTS_INTERNAL_URL is empty).');

        Http::assertNothingSent();
    }

    public function test_a_point_set_with_the_city_is_kept(): void
    {
        Http::fake();

        $posting = JobPosting::factory()->create(['location_psgc' => self::QC]);
        $posting->forceFill(['location_psgc' => '1381200000', 'location_lat' => 14.5764, 'location_lon' => 121.0851, 'location_checked_at' => now()])->save();

        $this->assertSame(14.5764, $posting->fresh()->location_lat);
    }
}
