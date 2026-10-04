export const ROLES = ['candidate', 'employer', 'admin'];

export const ROLE_LABELS = {
  candidate: 'Job seeker',
  employer: 'Employer',
  admin: 'Administrator',
};

/** Where each role lands after logging in. */
export function homeFor(role) {
  return ROLES.includes(role) ? `/${role}/dashboard` : '/';
}
