<?php

namespace App\Notifications;

use App\Models\Employer;
use Illuminate\Support\Str;

/** M9 in-app notice (and M13 email) to the employer when an admin approves or rejects (or removes) the company verification. */
class VerificationDecision extends AppNotice
{
    public function __construct(private readonly Employer $employer)
    {
        parent::__construct();
    }

    protected function subject(object $notifiable): string
    {
        return $this->employer->isVerified()
            ? "{$this->employer->company_name} is now verified on OpenDoor"
            : "{$this->employer->company_name} was not verified on OpenDoor";
    }

    public function databaseType(object $notifiable): string
    {
        return 'employer_verification';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $employer = $this->employer;
        $verified = $employer->isVerified();

        return [
            'message' => $verified
                ? "{$employer->company_name} is now verified. Candidates see the Verified badge on your postings."
                : "{$employer->company_name} was not verified: ".Str::finish(rtrim((string) $employer->verification_rejected_reason, '.!? '), '.').' Update your company profile to be checked again.',
            'url' => '/employer/company',
            'employer_id' => $employer->id,
            'verified' => $verified,
        ];
    }
}
