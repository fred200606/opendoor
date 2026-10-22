<?php

namespace App\Enums;

/** One entry in a hiring report's history (hiring_report_events). */
enum HiringReportAction: string
{
    case Reported = 'reported';
    case Confirmed = 'confirmed';
    case NotYet = 'not_yet';
    case Disputed = 'disputed';
    case Cancelled = 'cancelled';
}
