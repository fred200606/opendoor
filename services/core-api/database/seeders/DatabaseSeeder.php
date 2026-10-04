<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed master data and demo accounts. Every seeder is idempotent,
     * so `php artisan db:seed` can be re-run safely.
     */
    public function run(): void
    {
        $this->call([
            CategorySeeder::class,
            AccommodationSeeder::class,
            DemoUserSeeder::class,
            DemoEmployerSeeder::class,
        ]);
    }
}
