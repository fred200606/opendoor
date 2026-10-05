<?php

namespace Tests\Feature\Database;

use App\Enums\AccommodationGroup;
use App\Enums\UserRole;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\Category;
use App\Models\Feedback;
use App\Models\User;
use Database\Seeders\AccommodationSeeder;
use Database\Seeders\CategorySeeder;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoFeedbackSeeder;
use Database\Seeders\DemoUserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use RuntimeException;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    private const DEMO_PASSWORD = 'test-demo-password';

    protected function setUp(): void
    {
        parent::setUp();

        config(['opendoor.demo_password' => self::DEMO_PASSWORD]);
    }

    public function test_database_seeder_is_idempotent(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(count(CategorySeeder::CATEGORIES), Category::count());
        $this->assertSame(18, Accommodation::count()); // 4 + 3 + 5 + 3 + 3 types per data-model.md
        $formerEmployees = collect(DemoFeedbackSeeder::HIRES)->filter(fn ($hire) => str_starts_with($hire['email'], 'former'))->count();
        $this->assertSame(count(DemoUserSeeder::ACCOUNTS) + $formerEmployees, User::count());
        $this->assertSame(count(DemoFeedbackSeeder::HIRES), Application::where('status', 'hired')->count());
        $this->assertSame(5, Feedback::count());
    }

    public function test_the_first_demo_employer_has_a_published_trust_score(): void
    {
        $this->seed(DatabaseSeeder::class);
        $employer = User::where('email', 'employer@opendoor.test')->firstOrFail()->employer;

        // (3.5 + 3.5 + 2.5) of 12 rated items = 79.17 %.
        $this->assertSame(['published' => true, 'score' => 79, 'based_on' => 3], $employer->fresh()->trustScoreSummary());

        // employer2@: 2 responses; the open hire of candidate2@ would be the 3rd (Postman T10).
        $employer2 = User::where('email', 'employer2@opendoor.test')->firstOrFail()->employer;
        $this->assertSame(['published' => false, 'score' => null, 'based_on' => 2], $employer2->fresh()->trustScoreSummary());
        $open = Application::whereHas('candidateProfile.user', fn ($user) => $user->where('email', 'candidate2@opendoor.test'))->sole();
        $this->assertSame($employer2->id, $open->jobPosting->employer_id);
        $this->assertTrue($open->isFeedbackOpen());
        $this->assertFalse($open->feedback()->exists());
        $this->assertSame(3, $open->accommodationsAtHire()->count());
    }

    public function test_accommodations_cover_every_group_and_are_active(): void
    {
        $this->seed(AccommodationSeeder::class);

        foreach (AccommodationGroup::cases() as $group) {
            $this->assertTrue(Accommodation::where('group', $group)->exists(), "No accommodation in group {$group->value}");
        }
        $this->assertSame(Accommodation::count(), Accommodation::active()->count());
        $this->assertSame(
            AccommodationGroup::Communication,
            Accommodation::where('name', 'Sign language interpreter')->value('group'),
        );
    }

    public function test_demo_accounts_use_demo_password_and_roles(): void
    {
        $this->seed(DemoUserSeeder::class);

        $admin = User::where('email', 'admin@opendoor.test')->firstOrFail();
        $this->assertTrue($admin->isAdmin());
        $this->assertTrue($admin->is_active);
        $this->assertTrue(Hash::check(self::DEMO_PASSWORD, $admin->password));

        $this->assertSame(1, User::where('role', UserRole::Admin)->count());
        $this->assertTrue(User::where('role', UserRole::Candidate)->exists());
        $this->assertTrue(User::where('role', UserRole::Employer)->exists());
        $this->assertSame(0, User::whereNull('consented_at')->count());
    }

    public function test_demo_seeder_refuses_to_run_without_password(): void
    {
        config(['opendoor.demo_password' => null]);

        $this->expectException(RuntimeException::class);

        $this->seed(DemoUserSeeder::class);
    }

    public function test_reseeding_keeps_original_consent_timestamp(): void
    {
        $this->seed(DemoUserSeeder::class);
        $original = User::where('email', 'candidate@opendoor.test')->value('consented_at');

        $this->travel(2)->days();
        $this->seed(DemoUserSeeder::class);

        $this->assertEquals($original, User::where('email', 'candidate@opendoor.test')->value('consented_at'));
    }
}
