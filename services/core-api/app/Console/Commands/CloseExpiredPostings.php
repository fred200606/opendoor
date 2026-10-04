<?php

namespace App\Console\Commands;

use App\Enums\JobPostingStatus;
use App\Models\JobPosting;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/** Closes open postings whose closing date has passed (dates in Asia/Manila). Runs daily. */
#[Signature('postings:close-expired')]
#[Description('Close open job postings whose closing date has passed')]
class CloseExpiredPostings extends Command
{
    public function handle(): int
    {
        $closed = JobPosting::query()
            ->where('status', JobPostingStatus::Open)
            ->whereDate('closes_at', '<', today())
            ->update(['status' => JobPostingStatus::Closed, 'updated_at' => now()]);

        $this->info("Closed {$closed} expired posting(s).");

        return self::SUCCESS;
    }
}
