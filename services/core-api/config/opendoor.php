<?php

return [

    /*
    | Password for the seeded demo accounts. Read from the environment only;
    | the demo seeder refuses to run when it is empty.
    */
    'demo_password' => env('DEMO_PASSWORD'),

    /*
    | Public base URL of the API as the browser sees it (the gateway), used to build
    | file links such as logo_url. The client never talks to Core directly.
    */
    'public_api_url' => rtrim((string) env('PUBLIC_API_URL', 'http://localhost:8080/api'), '/'),

    /*
    | Public base URL of the React app, for links in emails (M13).
    */
    'public_app_url' => rtrim((string) env('PUBLIC_APP_URL', 'http://localhost:5173'), '/'),

    /*
    | Forgot password: queue connection for the reset-link job. `database` (default) keeps every
    | POST /forgot-password equally short, so its timing reveals no account; the scheduler works the
    | queue every minute. `sync` sends the email at once (tests; local use only).
    */
    'password_reset_queue' => env('PASSWORD_RESET_QUEUE', 'database'),

    /*
    | Upload limits (kilobytes), shared with the frontend and docs/openapi.yaml.
    */
    'logo_max_kb' => 2048,
    'resume_max_kb' => 5120,

];
