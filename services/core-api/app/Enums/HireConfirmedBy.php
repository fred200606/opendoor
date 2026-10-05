<?php

namespace App\Enums;

/** Who moved an application to hired (the employer, or the candidate with "I was hired"). */
enum HireConfirmedBy: string
{
    case Employer = 'employer';
    case Candidate = 'candidate';
}
