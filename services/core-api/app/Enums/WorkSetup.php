<?php

namespace App\Enums;

enum WorkSetup: string
{
    case Onsite = 'onsite';
    case Hybrid = 'hybrid';
    case Remote = 'remote';
}
