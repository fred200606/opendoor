<?php

namespace Tests\Feature\Postings;

use App\Enums\JobPostingStatus;
use App\Models\Application;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminPostingApprovalTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
    }

    public function test_queue_lists_pending_postings_oldest_first(): void
    {
        $newer = JobPosting::factory()->pending()->create(['updated_at' => now()]);
        $older = JobPosting::factory()->pending()->create(['updated_at' => now()->subDays(2)]);
        JobPosting::factory()->open()->create();
        $this->actingAsAdmin();

        $this->getJson('/api/admin/job-postings')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $older->id)
            ->assertJsonPath('data.1.id', $newer->id)
            ->assertJsonStructure(['data' => [['description', 'accommodations', 'employer' => ['company_name'], 'rejection_reason']], 'meta' => ['total', 'per_page']]);

        $this->getJson('/api/admin/job-postings?status=open')->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'open');
        $this->getJson('/api/admin/job-postings?status=archived')->assertUnprocessable();
    }

    public function test_approving_opens_the_posting_for_search(): void
    {
        $posting = JobPosting::factory()->pending()->create();
        $this->actingAsAdmin();

        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'approve'])
            ->assertOk()
            ->assertJsonPath('status', 'open');

        $this->assertTrue($posting->fresh()->is_approved);
        $this->assertTrue($posting->fresh()->isVisible());
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/job-postings/{$posting->id}")->assertOk();
    }

    public function test_rejecting_needs_a_reason_and_returns_the_posting_to_draft(): void
    {
        $posting = JobPosting::factory()->pending()->create();
        $this->actingAsAdmin();

        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'reject'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason' => 'Tell the employer why the posting was not approved.']);

        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'reject', 'reason' => '  Add the working hours.  '])
            ->assertOk()
            ->assertJsonPath('status', 'draft')
            ->assertJsonPath('rejection_reason', 'Add the working hours.');

        $this->assertFalse($posting->fresh()->is_approved);
    }

    public function test_employer_sees_the_reason_and_can_resubmit(): void
    {
        $posting = JobPosting::factory()->pending()->create();
        $this->actingAsAdmin();
        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'reject', 'reason' => 'Add the working hours.']);

        Sanctum::actingAs($posting->employer->user);
        $this->getJson("/api/job-postings/{$posting->id}")->assertOk()->assertJsonPath('rejection_reason', 'Add the working hours.');
        $this->getJson('/api/employer/job-postings?status=draft')->assertJsonPath('data.0.rejection_reason', 'Add the working hours.');
    }

    public function test_only_pending_postings_can_be_reviewed(): void
    {
        $open = JobPosting::factory()->open()->create();
        $draft = JobPosting::factory()->create();
        $this->actingAsAdmin();

        foreach ([$open, $draft] as $posting) {
            $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'approve'])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('action');
        }
        $this->assertSame(JobPostingStatus::Draft, $draft->fresh()->status);
    }

    public function test_an_expired_posting_cannot_be_approved(): void
    {
        $posting = JobPosting::factory()->pending()->create(['closes_at' => now()->subDay()->toDateString()]);
        $this->actingAsAdmin();

        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'approve'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('action');
    }

    public function test_only_admins_review_postings(): void
    {
        $posting = JobPosting::factory()->pending()->create();

        Sanctum::actingAs($posting->employer->user);
        $this->patchJson("/api/admin/job-postings/{$posting->id}/approve", ['action' => 'approve'])->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->getJson('/api/admin/job-postings')->assertForbidden();

        $this->assertSame(JobPostingStatus::PendingApproval, $posting->fresh()->status);
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
        $posting = JobPosting::factory()->pending()->create();
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
