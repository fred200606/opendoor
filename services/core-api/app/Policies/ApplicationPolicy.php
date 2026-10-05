<?php

namespace App\Policies;

use App\Models\Application;
use App\Models\User;

/**
 * Only the two parties see or change an application: the candidate who applied and the employer
 * that owns the posting. Which transition each may make is decided by ApplicationStatus.
 */
class ApplicationPolicy
{
    public function view(User $user, Application $application): bool
    {
        return $application->isByCandidate($user) || $application->isForEmployer($user);
    }

    public function changeStatus(User $user, Application $application): bool
    {
        return $this->view($user, $application);
    }
}
