<?php

namespace App\Enums;

/** M10: a report is open until an admin dismisses it or records the action taken. */
enum ReportStatus: string
{
    case Open = 'open';
    case Dismissed = 'dismissed';
    case Actioned = 'actioned';
}
