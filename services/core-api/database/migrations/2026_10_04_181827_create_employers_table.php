<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->restrictOnDelete();
            $table->string('company_name');
            $table->string('business_reg_no', 50);
            $table->enum('registry_type', ['DTI', 'SEC']);
            $table->string('industry', 100);
            $table->string('address');
            $table->string('location_psgc', 10)->nullable();
            // Display label chosen with the PSGC picker ("Quezon City, NCR"); PSGC data itself lives in Insights.
            $table->string('location_label')->nullable();
            $table->text('description')->nullable();
            $table->string('logo_path')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->string('verification_rejected_reason', 1000)->nullable();
            // Whole percentage 0–100, published from 3 non-hidden responses (TrustScoreService, Phase 5).
            $table->unsignedTinyInteger('trust_score')->nullable();
            $table->unsignedInteger('feedback_count')->default(0);
            $table->timestamps();

            // One company per registration number, so a business cannot be claimed twice.
            $table->unique(['registry_type', 'business_reg_no']);
            $table->index('verified_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employers');
    }
};
