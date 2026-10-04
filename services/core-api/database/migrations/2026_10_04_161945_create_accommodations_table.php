<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accommodations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->unique();
            $table->enum('group', ['physical_access', 'communication', 'work_arrangement', 'assistive_technology', 'support']);
            $table->string('description')->nullable();
            // Retired accommodations stay linked to old postings/needs/feedback but are hidden from new forms.
            $table->boolean('is_retired')->default(false);
            $table->timestamps();

            $table->index(['is_retired', 'group']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accommodations');
    }
};
