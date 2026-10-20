<?php

namespace App\Enums;

/**
 * Highest education of a candidate, or the minimum a posting asks for (Decision 2026-10-21).
 * Cases are in order: a level meets every requirement at or below it.
 */
enum EducationLevel: string
{
    case Elementary = 'elementary';
    case HighSchool = 'high_school';
    case SeniorHigh = 'senior_high';
    case Vocational = 'vocational';
    case College = 'college';
    case Postgraduate = 'postgraduate';

    public function rank(): int
    {
        return array_search($this, self::cases(), true);
    }

    public function meets(self $required): bool
    {
        return $this->rank() >= $required->rank();
    }
}
