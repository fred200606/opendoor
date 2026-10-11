<?php

namespace Tests\Feature\Notifications;

use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use App\Notifications\PostingReviewed;
use App\Notifications\VerificationDecision;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M9: own notifications, mark read / read all; admin decisions notify the employer. */
class NotificationTest extends TestCase
{
    use RefreshDatabase;

    private Employer $employer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->employer = Employer::factory()->create(['company_name' => 'Bright Path BPO Inc.']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** Sends $count notices to the employer, one minute apart (oldest first). */
    private function notifyEmployer(int $count): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create(['title' => 'Data Encoder']);
        for ($i = $count; $i > 0; $i--) {
            Carbon::setTestNow(now()->subMinutes($i));
            $this->employer->user->notify(new PostingReviewed($posting));
        }
        Carbon::setTestNow();
    }

    public function test_lists_own_notifications_newest_first_with_the_unread_count(): void
    {
        $this->notifyEmployer(13);
        $this->employer->user->notifications()->reorder()->oldest()->first()->markAsRead();
        User::factory()->candidate()->create()->notify(new VerificationDecision($this->employer));
        Sanctum::actingAs($this->employer->user);

        $response = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonCount(12, 'data')
            ->assertJsonPath('meta.total', 13)
            ->assertJsonPath('meta.unread_count', 12)
            ->assertJsonPath('data.0.type', 'posting_review')
            ->assertJsonPath('data.0.read_at', null)
            ->assertJsonPath('data.0.data.message', 'Your posting Data Encoder was approved and is now open to candidates.')
            ->assertJsonStructure(['data' => [['id', 'type', 'data' => ['message', 'url'], 'read_at', 'created_at']]]);

        $dates = array_column($response->json('data'), 'created_at');
        $this->assertSame($dates, collect($dates)->sortDesc()->values()->all());

        $this->getJson('/api/notifications?page=2')->assertJsonCount(1, 'data')->assertJsonPath('meta.unread_count', 12)->assertJsonPath('data.0.read_at', fn ($value) => $value !== null);
    }

    public function test_notices_from_the_same_second_are_still_newest_first(): void
    {
        $posting = JobPosting::factory()->open()->for($this->employer)->create();
        $this->freezeSecond(function () use ($posting) {
            $this->employer->user->notify(new PostingReviewed($posting));
            $this->employer->user->notify(new VerificationDecision($this->employer));
        });
        Sanctum::actingAs($this->employer->user);

        $response = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'employer_verification')
            ->assertJsonPath('data.1.type', 'posting_review');
        $this->assertSame($response->json('data.0.created_at'), $response->json('data.1.created_at'));
    }

    public function test_marks_one_notification_read_once(): void
    {
        $this->notifyEmployer(2);
        [$first, $second] = $this->employer->user->notifications()->get()->all();
        Sanctum::actingAs($this->employer->user);

        Carbon::setTestNow('2026-10-10 09:00:00');
        $this->patchJson("/api/notifications/{$first->id}/read")->assertNoContent();
        Carbon::setTestNow('2026-10-10 10:00:00');
        $this->patchJson("/api/notifications/{$first->id}/read")->assertNoContent();

        $this->assertSame('2026-10-10 09:00:00', $first->fresh()->read_at->toDateTimeString());
        $this->assertNull($second->fresh()->read_at);
        $this->getJson('/api/notifications')->assertJsonPath('meta.unread_count', 1);
    }

    public function test_other_users_and_unknown_notifications_are_not_found(): void
    {
        $this->notifyEmployer(1);
        $notification = $this->employer->user->notifications()->sole();
        Sanctum::actingAs(User::factory()->candidate()->create());

        foreach ([$notification->id, (string) Str::uuid(), 'abc'] as $id) {
            $this->patchJson("/api/notifications/{$id}/read")->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        }
        $this->assertNull($notification->fresh()->read_at);
    }

    public function test_marks_all_own_notifications_read(): void
    {
        $this->notifyEmployer(3);
        $other = User::factory()->candidate()->create();
        $other->notify(new VerificationDecision($this->employer));
        Sanctum::actingAs($this->employer->user);

        $this->patchJson('/api/notifications/read-all')->assertNoContent();

        $this->assertSame(0, $this->employer->user->unreadNotifications()->count());
        $this->assertSame(1, $other->unreadNotifications()->count());
        $this->getJson('/api/notifications')->assertJsonPath('meta.unread_count', 0);
    }

    public function test_admins_and_guests_have_no_notifications(): void
    {
        $this->getJson('/api/notifications')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson('/api/notifications')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        $this->patchJson('/api/notifications/read-all')->assertForbidden();
    }

    public function test_verification_decisions_notify_the_employer(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
        $url = "/api/admin/employers/{$this->employer->id}/verify";

        $this->patchJson($url, ['action' => 'reject', 'reason' => 'Registration number not found'])->assertOk();
        $this->travel(1)->seconds(); // both notices would otherwise share created_at and sort in any order
        $this->patchJson($url, ['action' => 'approve'])->assertOk();

        $notices = $this->employer->user->notifications()->get()->sortBy('created_at')->values();
        $this->assertCount(2, $notices);
        $this->assertSame('employer_verification', $notices[0]->type);
        $this->assertSame(
            'Bright Path BPO Inc. was not verified: Registration number not found. Update your company profile to be checked again.',
            $notices[0]->data['message'],
        );
        $this->assertSame('/employer/company', $notices[0]->data['url']);
        $this->assertFalse($notices[0]->data['verified']);
        $this->assertSame('Bright Path BPO Inc. is now verified. Candidates see the Verified badge on your postings.', $notices[1]->data['message']);
        $this->assertTrue($notices[1]->data['verified']);
    }

    public function test_posting_reviews_notify_the_employer(): void
    {
        $rejected = JobPosting::factory()->pending()->for($this->employer)->create(['title' => 'Chat Support']);
        $approved = JobPosting::factory()->pending()->for($this->employer)->create(['title' => 'Data Encoder']);
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->patchJson("/api/admin/job-postings/{$rejected->id}/approve", ['action' => 'reject', 'reason' => 'Add the working hours.'])->assertOk();
        $this->patchJson("/api/admin/job-postings/{$approved->id}/approve", ['action' => 'approve'])->assertOk();

        $data = $this->employer->user->notifications()->get()->pluck('data', 'data.job_posting_id');
        $this->assertSame([
            'message' => 'Your posting Chat Support was not approved: Add the working hours. Edit it and submit it again.',
            'url' => "/employer/jobs/{$rejected->id}/edit",
            'job_posting_id' => $rejected->id,
            'approved' => false,
        ], $data[$rejected->id]);
        $this->assertSame("/jobs/{$approved->id}", $data[$approved->id]['url']);
        $this->assertTrue($data[$approved->id]['approved']);
    }
}
