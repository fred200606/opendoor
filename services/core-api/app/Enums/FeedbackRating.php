<?php

namespace App\Enums;

/** How a hired candidate rates one advertised accommodation (business-rules.md). */
enum FeedbackRating: string
{
    case Delivered = 'delivered';
    case Partial = 'partial';
    case NotDelivered = 'not_delivered';

    /** Weight in the trust score formula. */
    public function weight(): float
    {
        return match ($this) {
            self::Delivered => 1.0,
            self::Partial => 0.5,
            self::NotDelivered => 0.0,
        };
    }
}
