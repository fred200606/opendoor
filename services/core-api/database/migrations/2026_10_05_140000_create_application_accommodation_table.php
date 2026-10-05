<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The accommodations a posting advertised when the application became hired – the items the
     * hired candidate rates (M7). Postings can be edited later; the promise at hire time counts.
     */
    public function up(): void
    {
        Schema::create('application_accommodation', function (Blueprint $table) {
            $table->foreignId('application_id')->constrained()->cascadeOnDelete();
            // restrictOnDelete: an accommodation in use is retired, not deleted (Admin\AccommodationController).
            $table->foreignId('accommodation_id')->constrained()->restrictOnDelete();

            $table->primary(['application_id', 'accommodation_id']);
            $table->index('accommodation_id');
        });

        // Applications hired before this table existed: take the posting's current accommodations.
        DB::statement(<<<'SQL'
            INSERT INTO application_accommodation (application_id, accommodation_id)
            SELECT a.id, jpa.accommodation_id
            FROM applications a
            JOIN job_posting_accommodation jpa ON jpa.job_posting_id = a.job_posting_id
            WHERE a.status = 'hired'
            SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('application_accommodation');
    }
};
