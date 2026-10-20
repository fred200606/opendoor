<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Decision 2026-10-21: the centre point and province of a profile's or posting's city, from the
 * Insights Service, for location matching and the distance filter. `location_checked_at` is when
 * Insights last answered for the current `location_psgc` (null = not asked yet or it was down).
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['candidate_profiles', 'job_postings'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->decimal('location_lat', 9, 6)->nullable()->after('location_label');
                $table->decimal('location_lon', 9, 6)->nullable()->after('location_lat');
                $table->string('location_province_psgc', 10)->nullable()->after('location_lon');
                $table->timestamp('location_checked_at')->nullable()->after('location_province_psgc');
            });
        }
    }

    public function down(): void
    {
        foreach (['candidate_profiles', 'job_postings'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->dropColumn(['location_lat', 'location_lon', 'location_province_psgc', 'location_checked_at']);
            });
        }
    }
};
