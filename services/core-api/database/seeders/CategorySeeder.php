<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /** Industry categories for job postings. */
    public const CATEGORIES = [
        'Administrative',
        'Customer Service',
        'Information Technology',
        'Accounting and Finance',
        'Sales and Marketing',
        'Business Process Outsourcing',
        'Education and Training',
        'Healthcare',
        'Hospitality and Food Service',
        'Manufacturing and Production',
        'Creative and Design',
    ];

    public function run(): void
    {
        foreach (self::CATEGORIES as $name) {
            Category::firstOrCreate(['name' => $name]);
        }
    }
}
