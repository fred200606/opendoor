<?php

use Illuminate\Support\Facades\Schedule;

// Postings close the day after their closing date (APP_TIMEZONE = Asia/Manila).
Schedule::command('postings:close-expired')->dailyAt('00:05')->withoutOverlapping();
