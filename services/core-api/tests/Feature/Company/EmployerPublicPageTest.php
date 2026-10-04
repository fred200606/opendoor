<?php

namespace Tests\Feature\Company;

use App\Models\Employer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployerPublicPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_sees_the_public_employer_page_without_private_data(): void
    {
        $employer = Employer::factory()->verified()->create(['company_name' => 'Bayanihan Tech Solutions']);

        $response = $this->getJson("/api/employers/{$employer->id}");

        $response->assertOk()
            ->assertJsonPath('company_name', 'Bayanihan Tech Solutions')
            ->assertJsonPath('verified', true)
            ->assertJsonPath('open_postings', [])
            ->assertJsonStructure(['id', 'company_name', 'verified', 'industry', 'address', 'location' => ['psgc_code', 'label'], 'description', 'logo_url', 'trust_score' => ['published', 'score', 'based_on']])
            ->assertJsonMissingPath('business_reg_no')
            ->assertJsonMissingPath('verification_rejected_reason')
            ->assertJsonMissingPath('user_id');
    }

    public function test_trust_score_is_published_only_from_three_responses(): void
    {
        $two = Employer::factory()->create(['trust_score' => 90, 'feedback_count' => 2]);
        $three = Employer::factory()->withTrustScore(86, 3)->create();

        $this->getJson("/api/employers/{$two->id}")->assertJsonPath('trust_score', ['published' => false, 'score' => null, 'based_on' => 2]);
        $this->getJson("/api/employers/{$three->id}")->assertJsonPath('trust_score', ['published' => true, 'score' => 86, 'based_on' => 3]);
    }

    public function test_unknown_employer_and_missing_logo_are_404(): void
    {
        $employer = Employer::factory()->create();

        $this->getJson('/api/employers/999999')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->getJson("/api/employers/{$employer->id}/logo")->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
