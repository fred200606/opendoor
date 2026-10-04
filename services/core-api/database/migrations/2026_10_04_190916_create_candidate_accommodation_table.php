<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_accommodation', function (Blueprint $table) {
            $table->foreignId('candidate_profile_id')->constrained()->cascadeOnDelete();
            // restrictOnDelete: an accommodation in use is retired, not deleted (Admin\AccommodationController).
            $table->foreignId('accommodation_id')->constrained()->restrictOnDelete();

            $table->primary(['candidate_profile_id', 'accommodation_id']);
            $table->index('accommodation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_accommodation');
    }
};
