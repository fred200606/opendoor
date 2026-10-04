<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('headline')->nullable();
            $table->json('skills')->nullable();
            $table->text('experience')->nullable();
            $table->string('location_psgc', 10)->nullable();
            $table->string('location_label')->nullable();
            // RA 10173: optional, never used for matching, shown to employers only if show_disability.
            $table->string('disability_type', 100)->nullable();
            $table->boolean('show_disability')->default(false);
            $table->string('resume_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_profiles');
    }
};
