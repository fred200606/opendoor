<?php

namespace App\Services;

use App\Models\CandidateProfile;
use Illuminate\Support\Facades\Storage;
use Smalot\PdfParser\Config;
use Smalot\PdfParser\Parser;
use Throwable;

/**
 * Suggests skills from the candidate's PDF résumé (Decision 2026-10-21): the text of the first
 * pages is read here in Core and matched against the shared skills list. The candidate confirms
 * the suggestions; the text itself is never stored or logged.
 */
class ResumeSkillExtractor
{
    public const MAX_PAGES = 10;

    /** Other spellings too common in ordinary sentences to suggest a skill ("Word", "design"). */
    private const AMBIGUOUS_ALIASES = ['word', 'design', 'research', 'writing', 'training', 'teaching', 'selling', 'inventory', 'packing', 'cleaning', 'cooking', 'drawing', 'reception', 'filing', 'encoding', 'english', 'filipino', 'leadership'];

    /** Aliases shorter than this are skipped ("AP", "QC"); list names are always used. */
    private const MIN_ALIAS_LENGTH = 4;

    public function __construct(private readonly SkillCatalog $catalog) {}

    /**
     * @return array{readable: bool, skills: list<string>} list names found in the résumé that the
     *                                                     profile does not have yet, in list order; readable=false when no text could be read
     */
    public function suggest(CandidateProfile $profile): array
    {
        $text = $this->text((string) $profile->resume_path);
        if ($text === null) {
            return ['readable' => false, 'skills' => []];
        }

        // Letters and digits only (keeps "c#", "react.js"-style dots and pluses inside words), one space between.
        $haystack = ' '.SkillCatalog::key(preg_replace('/[^\p{L}\p{N}+#.\']+/u', ' ', $text)).' ';
        $have = array_flip($this->catalog->keys($profile->skills));
        $names = [];

        foreach ($this->spellings() as $spelling => $name) {
            if (isset($have[SkillCatalog::key($name)]) || isset($names[$name])) {
                continue;
            }
            if (preg_match('/(?<![\p{L}\p{N}])'.preg_quote($spelling, '/').'(?![\p{L}\p{N}])/u', $haystack)) {
                $names[$name] = true;
            }
        }

        return ['readable' => true, 'skills' => array_keys($names)];
    }

    /** @return array<string, string> spelling key → list name; list names first, then usable aliases */
    private function spellings(): array
    {
        $lookup = $this->catalog->lookup();
        $names = array_filter($lookup, fn (string $name, string $key) => SkillCatalog::key($name) === $key, ARRAY_FILTER_USE_BOTH);
        $aliases = array_filter(
            $lookup,
            fn (string $name, string $key) => SkillCatalog::key($name) !== $key && mb_strlen($key) >= self::MIN_ALIAS_LENGTH && ! in_array($key, self::AMBIGUOUS_ALIASES, true),
            ARRAY_FILTER_USE_BOTH,
        );

        return $names + $aliases;
    }

    /** The text of the first pages, or null when the file is missing, not a readable PDF or has no text (a scan). */
    private function text(string $path): ?string
    {
        if ($path === '' || ! Storage::exists($path)) {
            return null;
        }

        try {
            $config = new Config;
            $config->setRetainImageContent(false);
            $pages = array_slice((new Parser([], $config))->parseContent((string) Storage::get($path))->getPages(), 0, self::MAX_PAGES);
            $text = implode("\n", array_map(fn ($page) => $page->getText(), $pages));
        } catch (Throwable) {
            return null;
        }

        return trim($text) === '' ? null : $text;
    }
}
