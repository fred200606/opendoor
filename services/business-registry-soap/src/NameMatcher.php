<?php

declare(strict_types=1);

namespace OpenDoor\Registry;

/**
 * NameMatchScore (integrations.md): both names are normalized (upper case, "&" → "AND",
 * punctuation removed, company-form suffixes such as INC. or CORP. dropped), then compared with
 * similar_text() and returned as 0–1 rounded to 2 decimals.
 */
final class NameMatcher
{
    /** Legal-form words that say nothing about which business it is. */
    private const SUFFIXES = ['INC', 'INCORPORATED', 'CORP', 'CORPORATION', 'CO', 'COMPANY', 'LTD', 'LIMITED', 'OPC'];

    public static function normalize(string $name): string
    {
        $name = strtoupper(trim($name));
        $name = str_replace('&', ' AND ', $name);
        $name = (string) preg_replace('/[^A-Z0-9 ]+/', ' ', $name);
        $words = preg_split('/\s+/', $name, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        // Drop legal-form words at the end only ("CO" inside a name stays: "CO WORKING HUB").
        while (count($words) > 1 && in_array(end($words), self::SUFFIXES, true)) {
            array_pop($words);
        }

        return implode(' ', $words);
    }

    public static function score(string $submitted, string $registered): float
    {
        $a = self::normalize($submitted);
        $b = self::normalize($registered);
        if ($a === '' || $b === '') {
            return 0.0;
        }
        if ($a === $b) {
            return 1.0;
        }

        similar_text($a, $b, $percent);

        return round($percent / 100, 2);
    }
}
