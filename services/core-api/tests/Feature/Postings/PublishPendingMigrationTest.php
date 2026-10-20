<?php

namespace Tests\Feature\Postings;

use App\Enums\JobPostingStatus;
use App\Models\Employer;
use App\Models\JobPosting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/** Decision 2026-10-21: postings that waited for admin approval are published or sent back to draft. */
class PublishPendingMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_postings_open_for_verified_companies_and_return_to_draft_otherwise(): void
    {
        $verified = JobPosting::factory()->for(Employer::factory()->verified())->create();
        $unverified = JobPosting::factory()->unverifiedEmployer()->create();
        $draft = JobPosting::factory()->create();
        DB::table('job_postings')->whereIn('id', [$verified->id, $unverified->id])->update(['status' => 'pending_approval', 'rejection_reason' => 'Old note']);

        (require database_path('migrations/2026_10_21_090000_publish_pending_job_postings.php'))->up();

        $this->assertSame(JobPostingStatus::Open, $verified->fresh()->status);
        $this->assertTrue($verified->fresh()->is_approved);
        $this->assertNull($verified->fresh()->rejection_reason);
        $this->assertSame(JobPostingStatus::Draft, $unverified->fresh()->status);
        $this->assertFalse($unverified->fresh()->is_approved);
        $this->assertSame(JobPostingStatus::Draft, $draft->fresh()->status);
    }
}
