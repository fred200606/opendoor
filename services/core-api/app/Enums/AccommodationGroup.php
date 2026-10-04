<?php

namespace App\Enums;

/** Accommodation groups based on RA 7277 (Magna Carta for Persons with Disability). */
enum AccommodationGroup: string
{
    case PhysicalAccess = 'physical_access';
    case Communication = 'communication';
    case WorkArrangement = 'work_arrangement';
    case AssistiveTechnology = 'assistive_technology';
    case Support = 'support';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::PhysicalAccess => 'Physical access',
            self::Communication => 'Communication',
            self::WorkArrangement => 'Work arrangement',
            self::AssistiveTechnology => 'Assistive technology',
            self::Support => 'Support',
        };
    }
}
