<?php

namespace Tests\Feature\Candidate;

use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CandidateProfileTest extends TestCase
{
    use RefreshDatabase;

    private User $candidate;

    protected function setUp(): void
    {
        parent::setUp();

        $this->candidate = User::factory()->candidate()->create(['name' => 'Maria Santos']);
        Sanctum::actingAs($this->candidate);
    }

    /** Path + query of a gateway URL, so the test can call it on Core. */
    private function pathOf(string $url): string
    {
        $parts = parse_url($url);

        return $parts['path'].'?'.$parts['query'];
    }

    public function test_a_new_candidate_gets_an_empty_profile(): void
    {
        $this->getJson('/api/candidate/profile')
            ->assertOk()
            ->assertJsonPath('headline', null)
            ->assertJsonPath('skills', [])
            ->assertJsonPath('location', ['psgc_code' => null, 'label' => null])
            ->assertJsonPath('show_disability', false)
            ->assertJsonPath('resume_url', null)
            ->assertJsonPath('accommodations', []);

        $this->assertSame(1, CandidateProfile::where('user_id', $this->candidate->id)->count());
        $this->getJson('/api/candidate/profile')->assertOk();
        $this->assertSame(1, CandidateProfile::count());
    }

    public function test_candidate_updates_the_profile(): void
    {
        $this->putJson('/api/candidate/profile', [
            'headline' => '  Data encoder  ',
            'skills' => ['Excel', ' Filing ', '', 'Excel'],
            'experience' => '3 years at a BPO.',
            'location_psgc' => '1381300000',
            'location_label' => 'Quezon City, NCR',
            'disability_type' => 'Deaf',
            'show_disability' => true,
        ])
            ->assertOk()
            ->assertJsonPath('headline', 'Data encoder')
            ->assertJsonPath('skills', ['Excel', 'Filing'])
            ->assertJsonPath('location', ['psgc_code' => '1381300000', 'label' => 'Quezon City, NCR'])
            ->assertJsonPath('disability_type', 'Deaf')
            ->assertJsonPath('show_disability', true);
    }

    public function test_show_disability_is_off_without_a_disability_type(): void
    {
        $this->putJson('/api/candidate/profile', ['disability_type' => '', 'show_disability' => true])
            ->assertOk()
            ->assertJsonPath('disability_type', null)
            ->assertJsonPath('show_disability', false);
    }

    public function test_profile_input_is_validated(): void
    {
        $this->putJson('/api/candidate/profile', [
            'skills' => array_map(fn ($i) => "Skill {$i}", range(1, 31)),
            'location_psgc' => 'Quezon',
            'headline' => str_repeat('x', 256),
        ])->assertUnprocessable()->assertJsonValidationErrors(['skills', 'location_psgc', 'headline']);
    }

    public function test_needs_are_replaced_with_active_accommodations(): void
    {
        [$ramp, $interpreter, $remote] = Accommodation::factory()->count(3)->create()->all();

        $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => [$ramp->id, $interpreter->id]])
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => [$remote->id]])
            ->assertOk()
            ->assertJsonPath('data.0.id', $remote->id)
            ->assertJsonCount(1, 'data');

        $this->getJson('/api/candidate/profile')->assertJsonCount(1, 'accommodations');
        $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => []])->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_needs_reject_retired_unknown_and_duplicate_types(): void
    {
        $active = Accommodation::factory()->create();
        $retired = Accommodation::factory()->retired()->create(['name' => 'Fax relay']);

        $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => [$retired->id, 999, $active->id, $active->id]])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'accommodation_ids.0' => '“Fax relay” is no longer offered as an option.',
                'accommodation_ids.1' => 'This accommodation type does not exist.',
                'accommodation_ids.2' => 'Each accommodation can be chosen only once.',
            ]);

        $this->putJson('/api/candidate/accommodations', [])->assertUnprocessable()->assertJsonValidationErrors('accommodation_ids');
    }

    public function test_a_need_retired_later_may_be_kept(): void
    {
        $need = Accommodation::factory()->create();
        $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => [$need->id]])->assertOk();
        $need->update(['is_retired' => true]);

        $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => [$need->id]])->assertOk();
    }

    public function test_resume_upload_gives_a_signed_link_through_the_gateway(): void
    {
        Storage::fake();

        $url = $this->post('/api/candidate/resume', ['resume' => UploadedFile::fake()->create('cv.pdf', 300, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertOk()
            ->json('resume_url');

        $profile = CandidateProfile::sole();
        $this->assertStringStartsWith("http://localhost:8080/api/resumes/{$profile->id}?expires=", $url);
        Storage::assertExists($profile->resume_path);

        // The link works without a token (opened in a new tab) …
        $this->app['auth']->forgetGuards();
        $this->get($this->pathOf($url))
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('Content-Disposition', 'inline; filename="resume-maria-santos.pdf"');

        // … but not when tampered with or after it expires.
        $this->getJson($this->pathOf($url).'0')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->travel(31)->minutes();
        $this->getJson($this->pathOf($url))->assertForbidden();
    }

    public function test_a_new_resume_replaces_the_old_file(): void
    {
        Storage::fake();
        $upload = fn () => $this->post('/api/candidate/resume', ['resume' => UploadedFile::fake()->create('cv.pdf', 100, 'application/pdf')], ['Accept' => 'application/json'])->assertOk();

        $upload();
        $first = CandidateProfile::sole()->resume_path;
        $upload();

        Storage::assertMissing($first);
        $this->assertNotSame($first, CandidateProfile::sole()->resume_path);
    }

    public function test_resume_must_be_a_pdf_of_at_most_5_mb(): void
    {
        $this->post('/api/candidate/resume', ['resume' => UploadedFile::fake()->create('cv.docx', 100, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['resume' => 'Upload your résumé as a PDF file.']);

        $this->post('/api/candidate/resume', ['resume' => UploadedFile::fake()->create('cv.pdf', 6000, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['resume' => 'The résumé must not be larger than 5 MB.']);
    }

    public function test_only_candidates_have_a_profile(): void
    {
        foreach (['employer', 'admin'] as $role) {
            Sanctum::actingAs(User::factory()->{$role}()->create());

            $this->getJson('/api/candidate/profile')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
            $this->putJson('/api/candidate/accommodations', ['accommodation_ids' => []])->assertForbidden();
        }

        $this->assertSame(0, CandidateProfile::count());
    }
}
