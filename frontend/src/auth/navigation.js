// Portal navigation per role (paths follow the SIA documentation's screen list).

export const NAVIGATION = {
  guest: [{ to: '/jobs', label: 'Find jobs' }],
  candidate: [
    { to: '/candidate/dashboard', label: 'Dashboard' },
    { to: '/candidate/jobs', label: 'Find jobs' },
    { to: '/candidate/applications', label: 'My applications' },
    { to: '/candidate/saved-jobs', label: 'Saved jobs' },
    { to: '/candidate/profile', label: 'Profile and needs' },
  ],
  employer: [
    { to: '/employer/dashboard', label: 'Dashboard' },
    { to: '/employer/jobs', label: 'Job postings' },
    { to: '/employer/company', label: 'Company profile' },
    { to: '/employer/trust-score', label: 'Trust score' },
  ],
  admin: [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/employers', label: 'Employers' },
    { to: '/admin/job-postings', label: 'Postings' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/feedback', label: 'Feedback' },
    { to: '/admin/master-data', label: 'Master data' },
  ],
};

/** Where job links point for this viewer (candidates stay inside their portal). */
export function jobPath(role, id) {
  return role === 'candidate' ? `/candidate/jobs/${id}` : `/jobs/${id}`;
}
