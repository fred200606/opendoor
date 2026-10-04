<?php

namespace App\Policies;

use App\Models\JobPosting;
use App\Models\User;

/** An employer manages only its own postings; anyone may see open, approved postings. */
class JobPostingPolicy
{
    public function view(?User $user, JobPosting $posting): bool
    {
        return $posting->isVisible() || $posting->isOwnedBy($user) || (bool) $user?->isAdmin();
    }

    public function update(User $user, JobPosting $posting): bool
    {
        return $posting->isOwnedBy($user);
    }

    public function delete(User $user, JobPosting $posting): bool
    {
        return $posting->isOwnedBy($user);
    }

    public function changeStatus(User $user, JobPosting $posting): bool
    {
        return $posting->isOwnedBy($user);
    }
}
