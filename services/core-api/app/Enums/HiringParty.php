<?php

namespace App\Enums;

/** The two parties of an application: who reported a hire, who answered (Decision 2026-10-22b). */
enum HiringParty: string
{
    case Employer = 'employer';
    case Candidate = 'candidate';

    public function other(): self
    {
        return $this === self::Employer ? self::Candidate : self::Employer;
    }
}
