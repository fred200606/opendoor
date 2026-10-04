<?php

namespace App\Models;

use App\Enums\AccommodationGroup;
use Database\Factories\AccommodationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'group', 'description', 'is_retired'])]
class Accommodation extends Model
{
    /** @use HasFactory<AccommodationFactory> */
    use HasFactory;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_retired' => false,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'group' => AccommodationGroup::class,
            'is_retired' => 'boolean',
        ];
    }

    /** Accommodations that may be picked on new postings and candidate needs. */
    #[Scope]
    protected function active(Builder $query): void
    {
        $query->where('is_retired', false);
    }
}
