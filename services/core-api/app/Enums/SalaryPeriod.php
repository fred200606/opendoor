<?php

namespace App\Enums;

/** What a posting's salary range is paid per (Decision 2026-10-22e). */
enum SalaryPeriod: string
{
    case Hour = 'hour';
    case Day = 'day';
    case Month = 'month';
    case Year = 'year';
}
