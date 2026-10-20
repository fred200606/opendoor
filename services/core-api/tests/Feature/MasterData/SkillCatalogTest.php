<?php

namespace Tests\Feature\MasterData;

use App\Models\Skill;
use App\Services\SkillCatalog;
use Database\Seeders\SkillSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SkillCatalogTest extends TestCase
{
    use RefreshDatabase;

    public function test_known_spellings_become_the_list_name_and_duplicates_go(): void
    {
        Skill::factory()->create(['name' => 'Microsoft Excel', 'aliases' => ['Excel', 'MS Excel']]);
        Skill::factory()->create(['name' => 'Filipino Sign Language', 'aliases' => ['FSL']]);
        $catalog = new SkillCatalog;

        $this->assertSame(
            ['Microsoft Excel', 'Filipino Sign Language', 'Inventory counting'],
            $catalog->normalize(['ms  excel', 'fsl', 'Excel', ' Inventory   counting ', 'INVENTORY COUNTING']),
        );
        $this->assertSame(['microsoft excel', 'basket weaving'], $catalog->keys(['MS Excel', 'Basket weaving']));
        $this->assertSame([], $catalog->keys(null));
    }

    public function test_no_spelling_in_the_seeded_list_belongs_to_two_skills(): void
    {
        $spellings = collect(SkillSeeder::SKILLS)
            ->flatMap(fn (array $aliases, string $name) => [$name, ...$aliases])
            ->map(SkillCatalog::key(...));

        $this->assertSame([], $spellings->duplicates()->values()->all());
    }
}
