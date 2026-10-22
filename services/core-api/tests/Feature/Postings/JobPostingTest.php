<?php

namespace Tests\Feature\Postings;

use App\Enums\JobPostingStatus;
use App\Models\Accommodation;
use App\Models\Category;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class JobPostingTest extends TestCase
{
    use RefreshDatabase;

    private Employer $employer;

    private Category $category;

    /** @var list<Accommodation> */
    private array $accommodations;

    protected function setUp(): void
    {
        parent::setUp();

        $this->employer = Employer::factory()->verified()->create();
        $this->category = Category::factory()->create(['name' => 'Administrative']);
        $this->accommodations = Accommodation::factory()->count(3)->create()->all();
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'title' => 'Data Encoder',
            'description' => 'Encode records for the admin team.',
            'skills' => ['Data entry', 'Microsoft Excel'],
            'category_id' => $this->category->id,
            'address' => '25 Scout Tobias St.',
            'location_psgc' => '1381300000',
            'location_label' => 'Quezon City, NCR',
            'employment_type' => 'full_time',
            'work_setup' => 'onsite',
            'interview_format' => 'online',
            'closes_at' => now()->addMonth()->toDateString(),
            'accommodations' => [
                ['id' => $this->accommodations[0]->id, 'note' => 'Ramp at the main entrance'],
                ['id' => $this->accommodations[1]->id, 'note' => '  '],
                ['id' => $this->accommodations[2]->id],
            ],
            'submit' => true,
            ...$overrides,
        ];
    }

    private function actingAsOwner(): void
    {
        Sanctum::actingAs($this->employer->user);
    }

    // ---------- create

    public function test_t02_employer_submits_a_posting_with_three_accommodations_and_notes(): void
    {
        $this->actingAsOwner();

        $response = $this->postJson('/api/job-postings', $this->payload());

        $response->assertCreated()
            ->assertJsonPath('status', 'open')
            ->assertJsonPath('employer', ['id' => $this->employer->id, 'company_name' => $this->employer->company_name, 'verified' => true])
            ->assertJsonPath('category', ['id' => $this->category->id, 'name' => 'Administrative'])
            ->assertJsonPath('location', ['psgc_code' => '1381300000', 'label' => 'Quezon City, NCR'])
            ->assertJsonPath('closes_at', now()->addMonth()->toDateString())
            ->assertJsonCount(3, 'accommodations')
            ->assertJsonPath('accommodations.0.note', 'Ramp at the main entrance')
            ->assertJsonPath('accommodations.1.note', null)
            ->assertJsonPath('match', null)
            ->assertJsonPath('rejection_reason', null);

        $posting = JobPosting::sole();
        $this->assertTrue($posting->is_approved);
        $this->assertSame(3, $posting->accommodations()->count());
        $this->getJson('/api/job-postings')->assertJsonPath('data.0.id', $posting->id);
    }

    public function test_an_unverified_company_can_only_save_drafts(): void
    {
        $this->employer->forceFill(['verified_at' => null])->save();
        $this->actingAsOwner();

        $this->postJson('/api/job-postings', $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['submit' => 'Your company must be verified by an administrator before you can publish job postings. You can save this posting as a draft for now.']);
        $this->assertSame(0, JobPosting::count());

        $draft = $this->postJson('/api/job-postings', $this->payload(['submit' => false]))->assertCreated()->assertJsonPath('status', 'draft');
        $this->putJson("/api/job-postings/{$draft->json('id')}", $this->payload())->assertUnprocessable()->assertJsonValidationErrors('submit');
        $this->assertSame(JobPostingStatus::Draft, JobPosting::sole()->status);
    }

    public function test_postings_of_a_company_that_loses_its_verification_are_hidden(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create();
        $this->getJson("/api/job-postings/{$posting->id}")->assertOk();

        $this->employer->forceFill(['verified_at' => null])->save();

        $this->getJson("/api/job-postings/{$posting->id}")->assertNotFound();
        $this->getJson('/api/job-postings')->assertJsonPath('meta.total', 0);
        $this->actingAsOwner();
        $this->getJson("/api/job-postings/{$posting->id}")->assertOk()->assertJsonPath('status', 'open');
    }

    public function test_skills_and_qualifications_are_saved_under_their_list_names(): void
    {
        Skill::factory()->create(['name' => 'Microsoft Excel', 'aliases' => ['Excel', 'MS Excel']]);
        $this->actingAsOwner();

        $this->postJson('/api/job-postings', $this->payload([
            'skills' => [' ms excel ', 'Excel', 'Inventory  counting', ''],
            'education_level' => 'senior_high',
            'experience_years' => 1,
            'qualifications' => '  TESDA NC II in bookkeeping is a plus. ',
        ]))
            ->assertCreated()
            ->assertJsonPath('skills', ['Microsoft Excel', 'Inventory counting'])
            ->assertJsonPath('education_level', 'senior_high')
            ->assertJsonPath('experience_years', 1)
            ->assertJsonPath('qualifications', 'TESDA NC II in bookkeeping is a plus.');
    }

    public function test_job_details_salary_benefits_and_schedule_are_saved_and_shown(): void
    {
        $this->actingAsOwner();

        $id = $this->postJson('/api/job-postings', $this->payload([
            'responsibilities' => '  Encode records
Check records  ',
            'salary_min' => 18000,
            'salary_max' => 22000,
            'salary_period' => 'month',
            'benefits' => 'HMO from the first month',
            'schedule' => ' Monday to Friday, 9:00 AM to 5:00 PM ',
            'application_requirements' => 'A portfolio link.',
        ]))
            ->assertCreated()
            ->assertJsonPath('responsibilities', 'Encode records
Check records')
            ->assertJsonPath('salary', ['min' => 18000, 'max' => 22000, 'period' => 'month', 'currency' => 'PHP'])
            ->assertJsonPath('benefits', 'HMO from the first month')
            ->assertJsonPath('schedule', 'Monday to Friday, 9:00 AM to 5:00 PM')
            ->assertJsonPath('application_requirements', 'A portfolio link.')
            ->json('id');

        // One amount is a minimum; removing the amounts removes the salary (and its period).
        $this->putJson("/api/job-postings/{$id}", $this->payload(['salary_min' => 645, 'salary_max' => null, 'salary_period' => 'day']))
            ->assertOk()
            ->assertJsonPath('salary', ['min' => 645, 'max' => null, 'period' => 'day', 'currency' => 'PHP']);
        $this->putJson("/api/job-postings/{$id}", $this->payload(['salary_min' => null, 'salary_max' => null, 'salary_period' => 'day']))
            ->assertOk()
            ->assertJsonPath('salary', null);
        $this->assertNull(JobPosting::find($id)->salary_period);

        // Optional: a posting without any of them is fine (the card says "Salary not disclosed").
        $this->postJson('/api/job-postings', $this->payload())
            ->assertCreated()
            ->assertJsonPath('salary', null)
            ->assertJsonPath('responsibilities', null);
    }

    public function test_a_salary_needs_a_lowest_amount_a_period_and_an_ordered_range(): void
    {
        $this->actingAsOwner();

        $this->postJson('/api/job-postings', $this->payload(['salary_min' => 30000, 'salary_max' => 20000]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'salary_max' => 'The highest salary cannot be lower than the lowest.',
                'salary_period' => 'Choose what the salary is paid per.',
            ]);
        $this->postJson('/api/job-postings', $this->payload(['salary_max' => 20000, 'salary_period' => 'week']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['salary_min' => 'Enter the lowest salary too, or leave both amounts empty.', 'salary_period']);
        $this->postJson('/api/job-postings', $this->payload(['salary_min' => 0, 'salary_period' => 'month', 'schedule' => str_repeat('x', 256), 'responsibilities' => str_repeat('x', 4001)]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['salary_min', 'schedule', 'responsibilities']);
    }

    public function test_a_published_job_needs_a_skill_but_a_draft_does_not(): void
    {
        $this->actingAsOwner();

        $this->postJson('/api/job-postings', $this->payload(['skills' => []]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['skills' => 'List at least one skill this job needs.']);
        $this->postJson('/api/job-postings', $this->payload(['skills' => [], 'submit' => false]))->assertCreated()->assertJsonPath('skills', []);
        $this->postJson('/api/job-postings', $this->payload(['education_level' => 'phd', 'experience_years' => 41, 'skills' => [str_repeat('x', 51)]]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['education_level', 'experience_years' => 'Ask for at most 40 years of experience.', 'skills.0']);
    }

    public function test_save_as_draft(): void
    {
        $this->actingAsOwner();

        $this->postJson('/api/job-postings', $this->payload(['submit' => false]))
            ->assertCreated()
            ->assertJsonPath('status', 'draft');
    }

    public function test_status_and_approval_cannot_be_set_by_the_employer(): void
    {
        $this->actingAsOwner();

        $this->postJson('/api/job-postings', $this->payload(['status' => 'open', 'is_approved' => true]))
            ->assertCreated()
            ->assertJsonPath('status', 'open');

        $this->assertSame(['title' => 'Data Encoder'], JobPosting::sole()->only('title'));
    }

    public function test_a_company_profile_is_required_first(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->postJson('/api/job-postings', $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['company' => 'Create your company profile before posting a job.']);
    }

    public function test_input_is_validated(): void
    {
        $this->actingAsOwner();
        $retired = Accommodation::factory()->retired()->create(['name' => 'Fax relay']);

        $this->postJson('/api/job-postings', [
            'category_id' => 999,
            'employment_type' => 'freelance',
            'work_setup' => 'moon',
            'closes_at' => now()->subDay()->toDateString(),
            'accommodations' => [['id' => $retired->id], ['id' => $this->accommodations[0]->id], ['id' => $this->accommodations[0]->id]],
        ])->assertUnprocessable()->assertJsonValidationErrors([
            'title', 'description', 'category_id', 'address', 'employment_type', 'work_setup', 'interview_format',
            'closes_at' => 'The closing date cannot be in the past.',
            'accommodations.0.id' => '“Fax relay” is no longer offered as an option.',
            'accommodations.1.id' => 'Each accommodation can be listed only once.',
        ]);
    }

    public function test_only_employers_create_postings(): void
    {
        Sanctum::actingAs(User::factory()->candidate()->create());
        $this->postJson('/api/job-postings', $this->payload())->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    // ---------- update

    public function test_editing_an_open_posting_keeps_it_open(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create(['rejection_reason' => null]);
        $this->actingAsOwner();

        $this->putJson("/api/job-postings/{$posting->id}", $this->payload(['title' => 'Senior Data Encoder']))
            ->assertOk()
            ->assertJsonPath('title', 'Senior Data Encoder')
            ->assertJsonPath('status', 'open');

        $this->assertTrue($posting->fresh()->is_approved);
    }

    public function test_resubmitting_clears_the_rejection_reason(): void
    {
        $posting = JobPosting::factory()->for($this->employer)->create(['rejection_reason' => 'Add the working hours.']);
        $this->actingAsOwner();

        $this->getJson("/api/job-postings/{$posting->id}")->assertJsonPath('rejection_reason', 'Add the working hours.');
        $this->putJson("/api/job-postings/{$posting->id}", $this->payload())
            ->assertOk()
            ->assertJsonPath('rejection_reason', null);
    }

    public function test_a_submitted_posting_cannot_go_back_to_draft(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create();
        $this->actingAsOwner();

        $this->putJson("/api/job-postings/{$posting->id}", $this->payload(['submit' => false]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('submit');
    }

    public function test_a_retired_accommodation_may_stay_on_its_posting(): void
    {
        $posting = JobPosting::factory()->for($this->employer)->create();
        $posting->accommodations()->attach($this->accommodations[0]->id, ['note' => 'Ramp']);
        $this->accommodations[0]->update(['is_retired' => true]);
        $this->actingAsOwner();

        $this->putJson("/api/job-postings/{$posting->id}", $this->payload())->assertOk();
    }

    public function test_t08_employer_cannot_change_another_employers_posting(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create();
        Sanctum::actingAs(Employer::factory()->create()->user);

        $this->putJson("/api/job-postings/{$posting->id}", $this->payload())->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->patchJson("/api/job-postings/{$posting->id}/status", ['status' => 'closed'])->assertForbidden();
        $this->deleteJson("/api/job-postings/{$posting->id}")->assertForbidden();

        $this->assertSame(JobPostingStatus::Open, $posting->fresh()->status);
    }

    // ---------- open / close / delete

    public function test_owner_closes_and_reopens_a_published_posting(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create();
        $this->actingAsOwner();

        $this->patchJson("/api/job-postings/{$posting->id}/status", ['status' => 'closed'])->assertOk()->assertJsonPath('status', 'closed');
        $this->patchJson("/api/job-postings/{$posting->id}/status", ['status' => 'open'])->assertOk()->assertJsonPath('status', 'open');
    }

    public function test_drafts_expired_postings_and_unverified_companies_cannot_open_postings(): void
    {
        $this->actingAsOwner();
        $pending = JobPosting::factory()->for($this->employer)->create();
        $expired = JobPosting::factory()->closed()->for($this->employer)->create(['closes_at' => now()->subDay()->toDateString()]);

        $this->patchJson("/api/job-postings/{$pending->id}/status", ['status' => 'open'])->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->patchJson("/api/job-postings/{$expired->id}/status", ['status' => 'open'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'The closing date has passed. Change the closing date and submit the posting again.']);
        $this->patchJson("/api/job-postings/{$pending->id}/status", ['status' => 'draft'])->assertUnprocessable();

        $closed = JobPosting::factory()->closed()->for($this->employer)->create();
        $this->employer->forceFill(['verified_at' => null])->save();
        $this->patchJson("/api/job-postings/{$closed->id}/status", ['status' => 'open'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'Your company must be verified by an administrator before the posting can be opened again.']);
    }

    public function test_delete_is_a_soft_delete_that_hides_the_posting(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create();
        $this->actingAsOwner();

        $this->deleteJson("/api/job-postings/{$posting->id}")->assertNoContent();

        $this->assertSoftDeleted($posting);
        $this->getJson("/api/job-postings/{$posting->id}")->assertNotFound();
    }

    // ---------- visibility

    public function test_guests_see_open_approved_postings_only(): void
    {
        $open = JobPosting::factory()->open()->for($this->employer)->create();
        $draft = JobPosting::factory()->for($this->employer)->create(['rejection_reason' => 'Secret note']);

        $this->getJson("/api/job-postings/{$open->id}")->assertOk()->assertJsonMissingPath('rejection_reason');
        $this->getJson("/api/job-postings/{$draft->id}")->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->getJson('/api/job-postings/999999')->assertNotFound();
    }

    public function test_owner_and_admin_see_unpublished_postings(): void
    {
        $draft = JobPosting::factory()->for($this->employer)->create();

        $this->getJson("/api/job-postings/{$draft->id}", ['Authorization' => 'Bearer '.$this->employer->user->createToken('t')->plainTextToken])
            ->assertOk()->assertJsonPath('status', 'draft');

        $admin = User::factory()->admin()->create();
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/job-postings/{$draft->id}", ['Authorization' => 'Bearer '.$admin->createToken('t')->plainTextToken])->assertOk();

        $other = Employer::factory()->create()->user;
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/job-postings/{$draft->id}", ['Authorization' => 'Bearer '.$other->createToken('t')->plainTextToken])->assertNotFound();
    }

    public function test_employer_lists_own_postings_in_every_status(): void
    {
        JobPosting::factory()->for($this->employer)->create();
        JobPosting::factory()->open()->for($this->employer)->create();
        JobPosting::factory()->open()->create(); // someone else's
        $this->actingAsOwner();

        $this->getJson('/api/employer/job-postings')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.per_page', 12);
        $this->getJson('/api/employer/job-postings?status=open')->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'open');
    }

    public function test_public_employer_page_lists_open_postings_only(): void
    {
        JobPosting::factory()->open()->for($this->employer)->create(['title' => 'Visible']);
        JobPosting::factory()->for($this->employer)->create(['title' => 'Hidden']);
        JobPosting::factory()->open()->for($this->employer)->create(['title' => 'Deleted'])->delete();

        $this->getJson("/api/employers/{$this->employer->id}")
            ->assertOk()
            ->assertJsonCount(1, 'open_postings')
            ->assertJsonPath('open_postings.0.title', 'Visible');
    }

    // ---------- auto-close

    public function test_expired_open_postings_close_automatically(): void
    {
        $expired = JobPosting::factory()->open()->create(['closes_at' => now()->subDay()->toDateString()]);
        $lastDay = JobPosting::factory()->open()->create(['closes_at' => now()->toDateString()]);
        $draft = JobPosting::factory()->create(['closes_at' => now()->subDay()->toDateString()]);

        Artisan::call('postings:close-expired');

        $this->assertSame(JobPostingStatus::Closed, $expired->fresh()->status);
        $this->assertSame(JobPostingStatus::Open, $lastDay->fresh()->status);
        $this->assertSame(JobPostingStatus::Draft, $draft->fresh()->status);
    }
}
