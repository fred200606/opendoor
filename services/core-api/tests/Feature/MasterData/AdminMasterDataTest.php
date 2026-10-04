<?php

namespace Tests\Feature\MasterData;

use App\Models\Accommodation;
use App\Models\Category;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminMasterDataTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
    }

    /**
     * Stand-in for job_postings / candidate_accommodation, which arrive in later phases
     * and must reference master data with restrictOnDelete.
     */
    private function referenceFromAnotherTable(string $table, string $column, string $on, int $id): void
    {
        Schema::create($table, function (Blueprint $t) use ($column, $on) {
            $t->id();
            $t->foreignId($column)->constrained($on)->restrictOnDelete();
        });
        DB::table($table)->insert([$column => $id]);
    }

    // ---------- access

    public function test_only_admins_can_manage_master_data(): void
    {
        $category = Category::factory()->create();

        $this->postJson('/api/admin/categories', ['name' => 'Logistics'])->assertUnauthorized();

        foreach (['candidate', 'employer'] as $role) {
            Sanctum::actingAs(User::factory()->{$role}()->create());

            $this->postJson('/api/admin/categories', ['name' => 'Logistics'])->assertForbidden();
            $this->deleteJson("/api/admin/categories/{$category->id}")->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
            $this->getJson('/api/admin/accommodations')->assertForbidden();
        }

        $this->assertDatabaseMissing('categories', ['name' => 'Logistics']);
        $this->assertModelExists($category);
    }

    // ---------- categories

    public function test_admin_can_create_and_rename_a_category(): void
    {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/admin/categories', ['name' => '  Logistics  '])
            ->assertCreated()
            ->assertJsonPath('name', 'Logistics')
            ->json('id');

        $this->putJson("/api/admin/categories/{$id}", ['name' => 'Logistics and Warehousing'])
            ->assertOk()
            ->assertExactJson(['id' => $id, 'name' => 'Logistics and Warehousing']);
    }

    public function test_category_names_are_unique_but_can_be_resaved(): void
    {
        $this->actingAsAdmin();
        $healthcare = Category::factory()->create(['name' => 'Healthcare']);
        $other = Category::factory()->create();

        $this->postJson('/api/admin/categories', ['name' => 'Healthcare'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->putJson("/api/admin/categories/{$other->id}", ['name' => 'Healthcare'])->assertUnprocessable();
        $this->putJson("/api/admin/categories/{$healthcare->id}", ['name' => 'Healthcare'])->assertOk();
        $this->postJson('/api/admin/categories', ['name' => ''])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson('/api/admin/categories', ['name' => str_repeat('x', 101)])->assertUnprocessable();
    }

    public function test_unused_category_can_be_deleted(): void
    {
        $this->actingAsAdmin();
        $category = Category::factory()->create();

        $this->deleteJson("/api/admin/categories/{$category->id}")->assertNoContent();

        $this->assertModelMissing($category);
    }

    public function test_category_in_use_cannot_be_deleted(): void
    {
        $this->actingAsAdmin();
        $category = Category::factory()->create();
        $this->referenceFromAnotherTable('test_postings', 'category_id', 'categories', $category->id);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors('category');

        $this->assertModelExists($category);
    }

    public function test_missing_category_returns_404(): void
    {
        $this->actingAsAdmin();

        $this->putJson('/api/admin/categories/999', ['name' => 'X'])->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }

    // ---------- accommodations

    public function test_admin_lists_all_accommodations_including_retired(): void
    {
        $this->actingAsAdmin();
        Accommodation::factory()->create();
        Accommodation::factory()->retired()->create();

        $this->getJson('/api/admin/accommodations')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.1.is_retired', true);
    }

    public function test_admin_can_create_and_update_an_accommodation(): void
    {
        $this->actingAsAdmin();

        $id = $this->postJson('/api/admin/accommodations', [
            'name' => 'Quiet room',
            'group' => 'physical_access',
            'description' => 'A low-noise room for breaks.',
        ])
            ->assertCreated()
            ->assertJsonPath('group', 'physical_access')
            ->assertJsonPath('is_retired', false)
            ->json('id');

        $this->putJson("/api/admin/accommodations/{$id}", ['name' => 'Quiet room', 'group' => 'support', 'description' => null])
            ->assertOk()
            ->assertJsonPath('group', 'support')
            ->assertJsonPath('description', null);
    }

    public function test_accommodation_group_must_be_a_known_value(): void
    {
        $this->actingAsAdmin();

        $this->postJson('/api/admin/accommodations', ['name' => 'Quiet room', 'group' => 'disability_type'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('group');
    }

    public function test_retired_accommodation_can_be_restored(): void
    {
        $this->actingAsAdmin();
        $accommodation = Accommodation::factory()->retired()->create();

        $this->putJson("/api/admin/accommodations/{$accommodation->id}", [
            'name' => $accommodation->name,
            'group' => $accommodation->group->value,
            'is_retired' => false,
        ])->assertOk()->assertJsonPath('is_retired', false);
    }

    public function test_unused_accommodation_is_deleted(): void
    {
        $this->actingAsAdmin();
        $accommodation = Accommodation::factory()->create();

        $this->deleteJson("/api/admin/accommodations/{$accommodation->id}")->assertNoContent();

        $this->assertModelMissing($accommodation);
    }

    public function test_accommodation_in_use_is_retired_instead_of_deleted(): void
    {
        $this->actingAsAdmin();
        $accommodation = Accommodation::factory()->create();
        $this->referenceFromAnotherTable('test_needs', 'accommodation_id', 'accommodations', $accommodation->id);

        $this->deleteJson("/api/admin/accommodations/{$accommodation->id}")
            ->assertOk()
            ->assertJsonPath('id', $accommodation->id)
            ->assertJsonPath('is_retired', true);

        $this->assertTrue($accommodation->fresh()->is_retired);
        $this->getJson('/api/accommodations')->assertJsonMissing(['id' => $accommodation->id]);
    }
}
