<?php

namespace Tests\Feature\MasterData;

use App\Models\Accommodation;
use Database\Seeders\AccommodationSeeder;
use Database\Seeders\CategorySeeder;
use Database\Seeders\SkillSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicListsTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_list_categories_sorted_by_name(): void
    {
        $this->seed(CategorySeeder::class);

        $response = $this->getJson('/api/categories')->assertOk();

        $names = array_column($response->json('data'), 'name');
        $this->assertCount(count(CategorySeeder::CATEGORIES), $names);
        $this->assertSame($names, collect($names)->sort()->values()->all());
        $response->assertJsonStructure(['data' => [['id', 'name']]]);
    }

    public function test_guest_gets_the_skills_list_sorted_by_name_with_other_spellings(): void
    {
        $this->seed(SkillSeeder::class);

        $response = $this->getJson('/api/skills')->assertOk()->assertJsonStructure(['data' => [['id', 'name', 'aliases']]]);

        $names = array_column($response->json('data'), 'name');
        $this->assertCount(count(SkillSeeder::SKILLS), $names);
        $this->assertSame($names, collect($names)->sortBy(fn ($name) => $name, SORT_NATURAL | SORT_FLAG_CASE)->values()->all());
        $excel = collect($response->json('data'))->firstWhere('name', 'Microsoft Excel');
        $this->assertSame(['Excel', 'MS Excel', 'Spreadsheets'], $excel['aliases']);
        $this->assertSame([], collect($response->json('data'))->firstWhere('name', 'PHP')['aliases']);
    }

    public function test_guest_gets_accommodations_grouped_in_group_order(): void
    {
        $this->seed(AccommodationSeeder::class);

        $response = $this->getJson('/api/accommodations')->assertOk();

        $this->assertSame(
            ['physical_access', 'communication', 'work_arrangement', 'assistive_technology', 'support'],
            array_column($response->json('data'), 'group'),
        );
        $response->assertJsonPath('data.0.label', 'Physical access')
            ->assertJsonPath('data.0.items.0.name', 'Wheelchair-accessible entrance')
            ->assertJsonStructure(['data' => [['group', 'label', 'items' => [['id', 'name', 'group', 'description', 'is_retired']]]]]);
    }

    public function test_retired_accommodations_and_empty_groups_are_hidden(): void
    {
        Accommodation::factory()->create(['name' => 'Remote work', 'group' => 'work_arrangement']);
        Accommodation::factory()->retired()->create(['name' => 'Fax machine', 'group' => 'assistive_technology']);

        $response = $this->getJson('/api/accommodations')->assertOk();

        $response->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.group', 'work_arrangement')
            ->assertJsonMissing(['name' => 'Fax machine']);
    }
}
