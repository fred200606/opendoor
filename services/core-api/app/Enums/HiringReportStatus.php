<?php

namespace App\Enums;

/**
 * pending until the other party answers Confirm (confirmed) or Incorrect (disputed); "Not yet"
 * keeps it pending. A withdrawal or rejection cancels a pending report.
 */
enum HiringReportStatus: string
{
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Disputed = 'disputed';
    case Cancelled = 'cancelled';
}
