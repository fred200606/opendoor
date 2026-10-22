<?php

namespace App\Enums;

/** Who moved an application to contacted (the employer, or the candidate with "The employer contacted me"). */
enum ContactConfirmedBy: string
{
    case Employer = 'employer';
    case Candidate = 'candidate';
}
