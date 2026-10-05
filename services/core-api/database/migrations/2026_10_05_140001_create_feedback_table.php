<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One anonymous response per hired application; hidden responses leave the trust score.
        Schema::create('feedback', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->unique()->constrained()->restrictOnDelete();
            $table->text('comments')->nullable();
            $table->boolean('is_hidden')->default(false);
            $table->timestamps();
        });

        Schema::create('feedback_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feedback_id')->constrained('feedback')->cascadeOnDelete();
            // restrictOnDelete: an accommodation in use is retired, not deleted (Admin\AccommodationController).
            $table->foreignId('accommodation_id')->constrained()->restrictOnDelete();
            $table->enum('rating', ['delivered', 'partial', 'not_delivered']);

            $table->unique(['feedback_id', 'accommodation_id']);
            $table->index('accommodation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_items');
        Schema::dropIfExists('feedback');
    }
};
