<?php

namespace App\Enums;

enum UserRole: string
{
    case Candidate = 'candidate';
    case Employer = 'employer';
    case Admin = 'admin';

    /** @return list<string> */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Roles a visitor may pick on the register form (admins never self-register).
     *
     * @return list<string>
     */
    public static function selfRegistrable(): array
    {
        return [self::Candidate->value, self::Employer->value];
    }
}
