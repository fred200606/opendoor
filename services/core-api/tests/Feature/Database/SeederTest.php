<?php

namespace Tests\Feature\Database;

use App\Enums\AccommodationGroup;
use App\Enums\UserRole;
use App\Models\Accommodation;
use App\Models\Category;
use App\Models\User;
use Database\Seeders\AccommodationSeeder;
use Database\Seeders\CategorySeeder;
use Database\Seeders\DatabaseSeeder;
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
        $this->assertSame(count(DemoUserSeeder::ACCOUNTS), User::count());
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
