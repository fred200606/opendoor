<?php

use Illuminate\Support\Facades\Schedule;

// Postings close the day after their closing date (APP_TIMEZONE = Asia/Manila).
Schedule::command('postings:close-expired')->dailyAt('00:05')->withoutOverlapping();

// M13: tell hired candidates in the morning that their accommodation rating is open.
Schedule::command('feedback:remind')->dailyAt('08:00')->withoutOverlapping();
