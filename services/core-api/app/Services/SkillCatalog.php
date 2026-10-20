<?php

namespace App\Services;

use App\Models\Skill;

/**
 * The shared skills list (Decision 2026-10-21). Skills are stored as names; a name or alias from
 * the list is stored as the list's name, anything else as typed. Comparison ignores case and
 * extra spaces, so "ms excel", "Excel" and "Microsoft Excel" are the same skill.
 */
class SkillCatalog
{
    /** @var array<string, string>|null comparison key of every name and alias → list name */
    private ?array $lookup = null;

    public static function key(string $skill): string
    {
        return mb_strtolower(preg_replace('/\s+/u', ' ', trim($skill)));
    }

    /** @return array<string, string> */
    public function lookup(): array
    {
        if ($this->lookup === null) {
            $this->lookup = [];
            foreach (Skill::query()->orderBy('id')->get(['name', 'aliases']) as $skill) {
                foreach ([$skill->name, ...($skill->aliases ?? [])] as $spelling) {
                    $this->lookup[self::key($spelling)] ??= $skill->name;
                }
            }
        }

        return $this->lookup;
    }

    /** The list name for a known spelling, else the skill as typed (trimmed, single spaces). */
    public function canonical(string $skill): string
    {
        $clean = preg_replace('/\s+/u', ' ', trim($skill));

        return $this->lookup()[self::key($clean)] ?? $clean;
    }

    /**
     * List names where known, duplicates (in any spelling) removed, order kept.
     *
     * @param  iterable<string>  $skills
     * @return list<string>
     */
    public function normalize(iterable $skills): array
    {
        $result = [];
        foreach ($skills as $skill) {
            $name = $this->canonical($skill);
            $result[self::key($name)] ??= $name;
        }

        return array_values($result);
    }

    /**
     * Comparison keys of the skills (for matching).
     *
     * @param  iterable<string>|null  $skills
     * @return list<string>
     */
    public function keys(?iterable $skills): array
    {
        return array_map(self::key(...), $this->normalize($skills ?? []));
    }
}
