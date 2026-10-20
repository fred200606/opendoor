<?php

namespace Tests\Feature\Moderation;

use App\Enums\ReportStatus;
use App\Models\JobPosting;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M10: candidates report postings; admins dismiss or record the action taken. */
class ReportTest extends TestCase
{
    use RefreshDatabase;

    private User $candidate;

    private JobPosting $posting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->candidate = User::factory()->candidate()->create();
        $this->posting = JobPosting::factory()->open()->create(['title' => 'Data Encoder']);
    }

    public function test_a_candidate_reports_a_visible_posting(): void
    {
        Sanctum::actingAs($this->candidate);

        $this->postJson("/api/job-postings/{$this->posting->id}/reports", ['reason' => '  The ramp does not exist.  '])
            ->assertCreated()
            ->assertJsonPath('job_posting_id', $this->posting->id)
            ->assertJsonPath('reason', 'The ramp does not exist.')
            ->assertJsonPath('status', 'open')
            ->assertJsonMissingPath('note')
            ->assertJsonMissingPath('resolved_at');

        $report = Report::sole();
        $this->assertSame($this->candidate->id, $report->reporter_id);
        $this->assertSame(ReportStatus::Open, $report->status);
    }

    public function test_one_open_report_per_candidate_and_posting(): void
    {
        Sanctum::actingAs($this->candidate);
        $url = "/api/job-postings/{$this->posting->id}/reports";

        $this->postJson($url, ['reason' => 'Misleading accommodations.'])->assertCreated();
        $this->postJson($url, ['reason' => 'Again.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason' => 'You have already reported this posting. An administrator will review it.']);

        Report::query()->update(['status' => ReportStatus::Dismissed]);
        $this->postJson($url, ['reason' => 'Still misleading.'])->assertCreated();

        Sanctum::actingAs(User::factory()->candidate()->create());
        $this->postJson($url, ['reason' => 'Scam.'])->assertCreated();
        $this->assertSame(3, Report::count());
    }

    public function test_report_needs_a_reason_of_at_most_1000_characters(): void
    {
        Sanctum::actingAs($this->candidate);
        $url = "/api/job-postings/{$this->posting->id}/reports";

        $this->postJson($url, ['reason' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason' => 'Tell us what is wrong with this posting.']);
        $this->postJson($url, ['reason' => str_repeat('a', 1001)])->assertUnprocessable()->assertJsonValidationErrors('reason');
        $this->assertSame(0, Report::count());
    }

    public function test_postings_that_are_not_visible_cannot_be_reported(): void
    {
        $draft = JobPosting::factory()->create();
        $pending = JobPosting::factory()->open()->unverifiedEmployer()->create();
        $deleted = JobPosting::factory()->open()->create();
        $deleted->delete();
        Sanctum::actingAs($this->candidate);

        foreach ([$draft->id, $pending->id, $deleted->id, 999999] as $id) {
            $this->postJson("/api/job-postings/{$id}/reports", ['reason' => 'Fake.'])->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        }
        $this->assertSame(0, Report::count());
    }

    public function test_only_candidates_report(): void
    {
        $url = "/api/job-postings/{$this->posting->id}/reports";

        $this->postJson($url, ['reason' => 'Fake.'])->assertUnauthorized();
        foreach ([$this->posting->employer->user, User::factory()->admin()->create()] as $user) {
            Sanctum::actingAs($user);
            $this->postJson($url, ['reason' => 'Fake.'])->assertForbidden();
        }
        $this->assertSame(0, Report::count());
    }

    public function test_admin_queue_lists_open_reports_oldest_first_with_the_posting(): void
    {
        $newer = Report::factory()->for($this->posting)->create(['created_at' => now()->subHour()]);
        $older = Report::factory()->create(['created_at' => now()->subDays(2)]);
        $resolved = Report::factory()->resolved(ReportStatus::Actioned, 'Posting closed.')->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/admin/reports?status=open')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $older->id)
            ->assertJsonPath('data.1.id', $newer->id)
            ->assertJsonPath('data.1.job_posting.title', 'Data Encoder')
            ->assertJsonPath('data.1.job_posting.employer.company_name', $this->posting->employer->company_name)
            ->assertJsonStructure(['data' => [['id', 'job_posting_id', 'job_posting' => ['id', 'title', 'employer' => ['id', 'company_name', 'verified']], 'reason', 'status', 'note', 'resolved_at', 'created_at']], 'meta']);

        $this->getJson('/api/admin/reports?status=actioned')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $resolved->id)
            ->assertJsonPath('data.0.note', 'Posting closed.');
        $this->getJson('/api/admin/reports')->assertJsonPath('meta.total', 3)->assertJsonPath('data.0.id', $resolved->id);
        $this->getJson('/api/admin/reports?status=closed')->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_reports_of_deleted_postings_stay_readable(): void
    {
        $report = Report::factory()->for($this->posting)->create();
        $this->posting->delete();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson("/api/admin/reports/{$report->id}")
            ->assertOk()
            ->assertJsonPath('job_posting.title', 'Data Encoder');
    }

    public function test_admin_dismisses_or_actions_a_report_once(): void
    {
        $dismiss = Report::factory()->create();
        $action = Report::factory()->create();
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin);

        $this->patchJson("/api/admin/reports/{$dismiss->id}", ['status' => 'dismissed'])
            ->assertOk()
            ->assertJsonPath('status', 'dismissed')
            ->assertJsonPath('note', null);

        $this->patchJson("/api/admin/reports/{$action->id}", ['status' => 'actioned', 'note' => '  Asked the employer to correct it.  '])
            ->assertOk()
            ->assertJsonPath('status', 'actioned')
            ->assertJsonPath('note', 'Asked the employer to correct it.');

        $action->refresh();
        $this->assertSame($admin->id, $action->resolved_by);
        $this->assertNotNull($action->resolved_at);

        $this->patchJson("/api/admin/reports/{$action->id}", ['status' => 'dismissed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['status' => 'This report has already been resolved.']);
        $this->assertSame(ReportStatus::Actioned, $action->fresh()->status);
    }

    public function test_resolving_needs_a_final_status(): void
    {
        $report = Report::factory()->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        foreach ([[], ['status' => 'open'], ['status' => 'deleted']] as $body) {
            $this->patchJson("/api/admin/reports/{$report->id}", $body)->assertUnprocessable()->assertJsonValidationErrors('status');
        }
        $this->patchJson("/api/admin/reports/{$report->id}", ['status' => 'dismissed', 'note' => str_repeat('a', 1001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('note');
        $this->patchJson('/api/admin/reports/999999', ['status' => 'dismissed'])->assertNotFound();
        $this->assertSame(ReportStatus::Open, $report->fresh()->status);
    }

    public function test_only_admins_review_reports(): void
    {
        $report = Report::factory()->create(['reporter_id' => $this->candidate->id]);

        foreach ([$this->candidate, $this->posting->employer->user] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/admin/reports')->assertForbidden();
            $this->getJson("/api/admin/reports/{$report->id}")->assertForbidden();
            $this->patchJson("/api/admin/reports/{$report->id}", ['status' => 'dismissed'])->assertForbidden();
        }
        $this->assertSame(ReportStatus::Open, $report->fresh()->status);
    }
}
