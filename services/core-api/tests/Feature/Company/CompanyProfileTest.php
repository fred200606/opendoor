<?php

namespace Tests\Feature\Company;

use App\Models\Employer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CompanyProfileTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'company_name' => 'Kalinga Foods Inc.',
            'registry_type' => 'SEC',
            'business_reg_no' => 'cs201912345',
            'industry' => 'Food Manufacturing',
            'address' => '1200 Pasong Tamo Ext.',
            'location_psgc' => '1380300000',
            'location_label' => 'Makati City, NCR',
            'description' => 'Food production.',
            ...$overrides,
        ];
    }

    public function test_new_employer_gets_404_until_the_profile_exists(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->getJson('/api/employer/company')
            ->assertNotFound()
            ->assertJsonPath('error.code', 'NOT_FOUND')
            ->assertJsonPath('error.message', 'You have not created your company profile yet.');
    }

    public function test_employer_creates_the_company_profile(): void
    {
        $user = User::factory()->employer()->create();
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/employer/company', $this->payload());

        $response->assertOk()
            ->assertJsonPath('company_name', 'Kalinga Foods Inc.')
            ->assertJsonPath('business_reg_no', 'CS201912345')
            ->assertJsonPath('registry_type', 'SEC')
            ->assertJsonPath('location', ['psgc_code' => '1380300000', 'label' => 'Makati City, NCR'])
            ->assertJsonPath('verified', false)
            ->assertJsonPath('verified_at', null)
            ->assertJsonPath('logo_url', null)
            ->assertJsonPath('trust_score', ['published' => false, 'score' => null, 'based_on' => 0]);

        $this->assertSame($user->id, Employer::sole()->user_id);
        $this->getJson('/api/employer/company')->assertOk()->assertJsonPath('id', $response->json('id'));
    }

    public function test_changing_the_registration_number_removes_verification(): void
    {
        $employer = Employer::factory()->verified()->create(['registry_type' => 'SEC', 'business_reg_no' => 'CS201912345']);
        Sanctum::actingAs($employer->user);

        $this->putJson('/api/employer/company', $this->payload(['company_name' => 'Kalinga Foods Incorporated']))
            ->assertOk()
            ->assertJsonPath('verified', true);

        $this->putJson('/api/employer/company', $this->payload(['business_reg_no' => 'CS209999999']))
            ->assertOk()
            ->assertJsonPath('verified', false)
            ->assertJsonPath('verified_at', null);
    }

    public function test_saving_after_a_rejection_returns_the_company_to_the_queue(): void
    {
        $employer = Employer::factory()->rejected('Number not found.')->create();
        Sanctum::actingAs($employer->user);

        $this->putJson('/api/employer/company', $this->payload())
            ->assertOk()
            ->assertJsonPath('verification_rejected_reason', null);
    }

    public function test_verification_fields_cannot_be_set_by_the_employer(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->putJson('/api/employer/company', $this->payload([
            'verified_at' => now()->toIso8601String(),
            'trust_score' => 100,
            'feedback_count' => 50,
        ]))->assertOk()->assertJsonPath('verified', false)->assertJsonPath('trust_score.published', false);
    }

    public function test_registration_number_is_unique_per_registry(): void
    {
        Employer::factory()->create(['registry_type' => 'SEC', 'business_reg_no' => 'CS201912345']);
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->putJson('/api/employer/company', $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['business_reg_no' => 'Another company on OpenDoor already uses this registration number.']);

        $this->putJson('/api/employer/company', $this->payload(['registry_type' => 'DTI']))->assertOk();
    }

    public function test_required_fields_and_formats_are_validated(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->putJson('/api/employer/company', [
            'registry_type' => 'BIR',
            'business_reg_no' => 'no spaces!',
            'location_psgc' => 'Makati',
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'company_name', 'registry_type', 'business_reg_no', 'industry', 'address', 'location_psgc',
        ]);
    }

    public function test_logo_upload_is_multipart_with_method_spoofing_and_served_through_the_api(): void
    {
        Storage::fake();
        Sanctum::actingAs(User::factory()->employer()->create());

        $response = $this->post('/api/employer/company', [
            ...$this->payload(),
            '_method' => 'PUT',
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
        ], ['Accept' => 'application/json']);

        $response->assertOk();
        $employer = Employer::sole();
        Storage::assertExists($employer->logo_path);
        $this->assertStringStartsWith('http://localhost:8080/api/employers/'.$employer->id.'/logo?v=', $response->json('logo_url'));

        $this->get("/api/employers/{$employer->id}/logo")->assertOk()->assertHeader('Cache-Control');
    }

    public function test_replacing_the_logo_deletes_the_old_file(): void
    {
        Storage::fake();
        Sanctum::actingAs(User::factory()->employer()->create());
        $upload = fn () => $this->post('/api/employer/company', [
            ...$this->payload(),
            '_method' => 'PUT',
            'logo' => UploadedFile::fake()->image('logo.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $upload();
        $first = Employer::sole()->logo_path;
        $upload();

        Storage::assertMissing($first);
        Storage::assertExists(Employer::sole()->logo_path);
    }

    public function test_logo_must_be_a_small_image(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->post('/api/employer/company', [
            ...$this->payload(),
            '_method' => 'PUT',
            'logo' => UploadedFile::fake()->create('logo.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('logo');

        $this->post('/api/employer/company', [
            ...$this->payload(),
            '_method' => 'PUT',
            'logo' => UploadedFile::fake()->image('logo.png')->size(3000),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['logo' => 'The logo must not be larger than 2 MB.']);
    }

    public function test_only_employers_have_a_company_profile(): void
    {
        foreach (['candidate', 'admin'] as $role) {
            Sanctum::actingAs(User::factory()->{$role}()->create());

            $this->getJson('/api/employer/company')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
            $this->putJson('/api/employer/company', $this->payload())->assertForbidden();
        }

        $this->assertSame(0, Employer::count());
    }
}
