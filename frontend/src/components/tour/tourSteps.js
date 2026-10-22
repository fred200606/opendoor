// The welcome tour's steps per role (decision 2026-10-21f, after opendoor-ipt's "Quick
// introduction"). `route` is the page the step is shown on, `target` the data-tour name(s) of the
// part it points at: the first one on screen wins (the account menu, or Menu when the header is
// compact – then `compactText` replaces `text`). Menu names in quotes match auth/navigation.js.
const step = (id, title, text, route, target, extra = {}) => ({
  id,
  title,
  text,
  route,
  target,
  ...extra,
});

const DISPLAY = 'Use the bar at the very top of every page for larger text, high contrast or quiet mode. Your choices stay until you change them.';

export const TOUR_TITLE = 'Quick introduction';

export const TOUR_STEPS = {
  candidate: [
    step('comfort', 'Make OpenDoor comfortable', DISPLAY, '/candidate/dashboard', 'display-settings'),
    step(
      'dashboard',
      'Your starting point',
      'Your dashboard shows your applications, the jobs that match what you need, and the “Get started” list of what to do next.',
      '/candidate/dashboard',
      'page',
    ),
    step(
      'profile',
      'Your profile and your needs',
      'Open “Account”, then “Profile”, to add the accommodations you need, your skills and your résumé. We match on what you need, never on a disability.',
      '/candidate/dashboard',
      ['account-menu', 'compact-menu'],
      {
        compactText:
          'Open “Menu”, then “Profile”, to add the accommodations you need, your skills and your résumé. We match on what you need, never on a disability.',
      },
    ),
    step(
      'jobs',
      'Find jobs that fit you',
      'Search by job title or company. “Recommended for me” puts first the jobs that fit your skills, your place and the accommodations you need.',
      '/candidate/jobs',
      'job-search',
    ),
    step(
      'applications',
      'Follow your applications',
      'After you apply, see where each application stands here. Employers see your needs only when you apply to one of their jobs.',
      '/candidate/applications',
      'page',
    ),
    step(
      'updates',
      'Updates and ratings',
      '“Notifications” tells you when an application changes. 30 days after an employer contacts you, you can rate whether each promised accommodation was provided. Ratings are anonymous.',
      '/candidate/applications',
      ['notifications', 'compact-menu'],
      {
        compactText:
          '“Menu” has “Notifications”, which tells you when an application changes. 30 days after an employer contacts you, you can rate whether each promised accommodation was provided. Ratings are anonymous.',
      },
    ),
  ],
  employer: [
    step('comfort', 'Make OpenDoor comfortable', DISPLAY, '/employer/dashboard', 'display-settings'),
    step(
      'dashboard',
      'Your starting point',
      'Your dashboard shows your job postings, new applications, and the “Get started” list of what to do next.',
      '/employer/dashboard',
      'page',
    ),
    step(
      'company',
      'Set up your company and get verified',
      'Add your company here with its DTI or SEC registration number. An administrator checks it against the business registry. Once you are verified, each job goes live as soon as you publish it.',
      '/employer/company',
      'page',
    ),
    step(
      'postings',
      'Post jobs and review applicants',
      'List the skills and the accommodations each job offers, then review applications here. You see an applicant’s needs only when they apply to one of your jobs.',
      '/employer/jobs',
      'page',
    ),
    step(
      'trust',
      'Earn a trust score',
      '30 days after you mark an applicant as contacted, they can rate whether each promised accommodation was provided. After 3 ratings, your trust score appears on your jobs.',
      '/employer/trust-score',
      'page',
    ),
    step(
      'updates',
      'Stay up to date',
      '“Notifications” tells you about new applications and your verification.',
      '/employer/trust-score',
      ['notifications', 'compact-menu'],
      {
        compactText: '“Menu” has “Notifications”, which tells you about new applications and your verification.',
      },
    ),
  ],
};
