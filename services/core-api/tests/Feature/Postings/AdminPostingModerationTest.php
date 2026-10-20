<?php

namespace Tests\Feature\Postings;

use App\Models\Application;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminPostingModerationTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
    }

    public function test_lists_every_posting_newest_first_or_one_status(): void
    {
        $older = JobPosting::factory()->open()->create(['created_at' => now()->subDays(2)]);
        $newer = JobPosting::factory()->open()->create(['created_at' => now()]);
        $draft = JobPosting::factory()->create(['created_at' => now()->subDay()]);
        $this->actingAsAdmin();

        $this->getJson('/api/admin/job-postings')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $draft->id)
            ->assertJsonPath('data.2.id', $older->id)
            ->assertJsonStructure(['data' => [['description', 'accommodations', 'employer' => ['company_name'], 'rejection_reason']], 'meta' => ['total', 'per_page']]);

        $this->getJson('/api/admin/job-postings?status=open')->assertJsonCount(2, 'data')->assertJsonPath('data.0.status', 'open');
        $this->getJson('/api/admin/job-postings?status=pending_approval')->assertUnprocessable();
        $this->getJson('/api/admin/job-postings?status=archived')->assertUnprocessable();
    }

    public function test_the_approval_endpoint_is_gone(): void
    {
        $posting = JobPosting::factory()->open()->create();
        $this->actingAsAdmin();

        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'approve'])->assertNotFound();
    }

    public function test_only_admins_list_postings(): void
    {
        $posting = JobPosting::factory()->open()->create();

        Sanctum::actingAs($posting->employer->user);
        $this->getJson('/api/admin/job-postings')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_an_admin_removes_an_open_posting_with_a_reason_and_the_employer_is_told(): void
    {
        $posting = JobPosting::factory()->open()->create(['title' => 'Data Encoder']);
        $application = Application::factory()->create(['job_posting_id' => $posting->id]);
        $this->actingAsAdmin();

        $this->deleteJson("/api/admin/job-postings/{$posting->id}", ['reason' => 'The accommodations listed were found to be false.'])
            ->assertNoContent();

        $this->assertSoftDeleted($posting);
        $this->assertNotNull($application->fresh(), 'applications are kept');
        $this->getJson("/api/job-postings/{$posting->id}")->assertNotFound();

        $notice = $posting->employer->user->notifications()->sole();
        $this->assertSame('posting_review', $notice->type);
        $this->assertSame('Your posting Data Encoder was removed by an administrator: The accommodations listed were found to be false.', $notice->data['message']);
        $this->assertSame('/employer/jobs', $notice->data['url']);
        $this->assertTrue($notice->data['removed']);
    }

    public function test_removal_needs_a_reason_and_works_once(): void
    {
        $posting = JobPosting::factory()->create();
        $this->actingAsAdmin();
        $url = "/api/admin/job-postings/{$posting->id}";

        $this->deleteJson($url, ['reason' => '  '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason' => 'Tell the employer why the posting is removed.']);
        $this->assertNotSoftDeleted($posting);

        $this->deleteJson($url, ['reason' => 'Duplicate posting.'])->assertNoContent();
        $this->deleteJson($url, ['reason' => 'Again.'])->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->deleteJson('/api/admin/job-postings/999999', ['reason' => 'Unknown.'])->assertNotFound();
    }

    public function test_only_admins_remove_postings(): void
    {
        $posting = JobPosting::factory()->open()->create();

        Sanctum::actingAs($posting->employer->user);
        $this->deleteJson("/api/admin/job-postings/{$posting->id}", ['reason' => 'Mine.'])->assertForbidden();
        Sanctum::actingAs(User::factory()->candidate()->create());
        $this->deleteJson("/api/admin/job-postings/{$posting->id}", ['reason' => 'Bad.'])->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->deleteJson("/api/admin/job-postings/{$posting->id}", ['reason' => 'Bad.'])->assertUnauthorized();

        $this->assertNotSoftDeleted($posting);
    }
}
