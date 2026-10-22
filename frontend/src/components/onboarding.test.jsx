import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderApp, users } from '../test/render.jsx';

// Onboarding for first-time users (decision 2026-10-14): welcome tour + "Get started" list.
const fresh = { tour_done: false, checklist_hidden: false };
const toured = { tour_done: true, checklist_hidden: false };
const done = { tour_done: true, checklist_hidden: true };

const newCandidateDashboard = { applications: {}, needs_count: 0, matching_jobs: 0, feedback_due: [] };
const newEmployerDashboard = {
  company: { exists: false, verified: false },
  postings: { draft: 0, open: 0, closed: 0 },
  applications: {},
  trust_score: { published: false, based_on: 0 },
};

function candidateRoutes(onboarding, extra = {}) {
  return {
    'GET /me': () => [200, { ...users.candidate, onboarding }],
    'GET /candidate/dashboard': () => [200, newCandidateDashboard],
    ...extra,
  };
}

const patches = (calls) => calls.filter((call) => call.key === 'PATCH /me/onboarding').map((call) => call.data);

// jsdom has no layout: every part counts as on screen, so each step finds its part at once.
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ width: 1, height: 1 }]);
});
afterEach(() => vi.restoreAllMocks());

const tourStep = (number, title) => ({ level: 2, name: `Quick introduction, step ${number} of 6: ${title}` });

describe('Welcome tour', () => {
  test('starts on the dashboard after the first sign-in; Next and Back move focus to the step heading; Close saves it', async () => {
    const { user, calls } = renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: candidateRoutes(fresh, { 'PATCH /me/onboarding': () => [200, toured] }),
    });

    const guide = await screen.findByRole('complementary', { name: 'Welcome tour' });
    await waitFor(() => expect(within(guide).getByRole('heading', tourStep(1, 'Make OpenDoor comfortable'))).toHaveFocus());
    expect(within(guide).getByText(/bar at the very top of every page/)).toBeInTheDocument();
    expect(within(guide).queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    // The part the step is about is outlined, the rest of the page dimmed.
    expect(document.querySelector('[data-tour="display-settings"]')).toHaveClass('od-tour-target');
    expect(document.querySelector('.od-tour-dim')).toBeInTheDocument();

    await user.click(within(guide).getByRole('button', { name: 'Next' }));
    expect(within(guide).getByRole('heading', tourStep(2, 'Your starting point'))).toHaveFocus();
    await waitFor(() => expect(document.getElementById('main')).toHaveClass('od-tour-target'));
    expect(document.querySelector('[data-tour="display-settings"]')).not.toHaveClass('od-tour-target');
    await user.click(within(guide).getByRole('button', { name: 'Back' }));
    expect(within(guide).getByRole('heading', tourStep(1, 'Make OpenDoor comfortable'))).toHaveFocus();

    await user.click(within(guide).getByRole('button', { name: 'Close the tour' }));
    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
    expect(document.querySelector('.od-tour-dim')).not.toBeInTheDocument();
    await waitFor(() => expect(patches(calls)).toEqual([{ tour_done: true }]));
  });

  test('steps open their own page; the arrow keys move too; Escape stops it and saves it', async () => {
    const { user, calls, location } = renderApp('/employer/dashboard', {
      as: 'employer',
      routes: {
        'GET /me': () => [200, { ...users.employer, onboarding: fresh }],
        'GET /employer/dashboard': () => [200, newEmployerDashboard],
        'PATCH /me/onboarding': () => [200, toured],
      },
    });

    const guide = await screen.findByRole('complementary', { name: 'Welcome tour' });
    await waitFor(() => expect(within(guide).getByRole('heading', tourStep(1, 'Make OpenDoor comfortable'))).toHaveFocus());
    await user.keyboard('{ArrowRight}');
    expect(within(guide).getByRole('heading', tourStep(2, 'Your starting point'))).toHaveFocus();
    await user.click(within(guide).getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(location()).toBe('/employer/company'));
    await waitFor(() => expect(within(guide).getByRole('heading', tourStep(3, 'Set up your company and get verified'))).toHaveFocus());
    expect(within(guide).getByText(/DTI or SEC registration number/)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
    await waitFor(() => expect(patches(calls)).toEqual([{ tour_done: true }]));
  });

  test('going to another page yourself stops it without saving', async () => {
    const { user, calls } = renderApp('/candidate/dashboard', { as: 'candidate', routes: candidateRoutes(fresh) });

    await screen.findByRole('complementary', { name: 'Welcome tour' });
    await user.click(screen.getByRole('link', { name: 'Saved jobs' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Saved jobs' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
    expect(patches(calls)).toEqual([]);
  });

  test('not shown once done', async () => {
    renderApp('/candidate/dashboard', { as: 'candidate', routes: candidateRoutes(toured) });
    expect(await screen.findByRole('heading', { name: 'My applications' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
  });
});

describe('Get started list', () => {
  test('job seeker: steps tick themselves from the dashboard and the profile', async () => {
    renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: candidateRoutes(toured, {
        'GET /candidate/dashboard': () => [200, { ...newCandidateDashboard, needs_count: 1 }],
        'GET /candidate/profile': () => [200, { skills: ['Excel'], resume_url: null, accommodations: [{ id: 2, name: 'Accessible restroom' }] }],
      }),
    });

    const list = await screen.findByRole('region', { name: 'Get started' });
    expect(within(list).getByText('2 of 4 done')).toBeInTheDocument();
    expect(within(list).getAllByRole('listitem').map((item) => item.querySelector('.get-started__title').textContent)).toEqual([
      'Done: Create your account',
      'Done: Add the accommodations you need',
      'To do: Add your skills and résumé',
      'To do: Apply to a job that fits',
    ]);
    expect(within(list).queryByRole('link', { name: 'Add your needs' })).not.toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Complete your profile' })).toHaveAttribute('href', '/candidate/profile?tab=resume');
    expect(within(list).getByRole('link', { name: 'Find jobs' })).toHaveAttribute('href', '/candidate/jobs');
  });

  test('a brand-new job seeker (no profile yet) starts with 1 of 4', async () => {
    renderApp('/candidate/dashboard', { as: 'candidate', routes: candidateRoutes(toured) });

    const list = await screen.findByRole('region', { name: 'Get started' });
    expect(within(list).getByText('1 of 4 done')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Add your needs' })).toHaveAttribute('href', '/candidate/profile');
    expect(within(list).getByRole('link', { name: 'Complete your profile' })).toHaveAttribute('href', '/candidate/profile?tab=about');
  });

  test('Hide this list saves it, and the message that replaces it takes focus', async () => {
    const { user, calls } = renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: candidateRoutes(toured, { 'PATCH /me/onboarding': () => [200, done] }),
    });

    const list = await screen.findByRole('region', { name: 'Get started' });
    await user.click(within(list).getByRole('button', { name: 'Hide this list' }));

    const message = await screen.findByText(/list is hidden/);
    expect(message).toHaveFocus();
    expect(within(message).getByRole('link', { name: 'Account settings' })).toHaveAttribute('href', '/account?tab=onboarding');
    expect(screen.queryByRole('region', { name: 'Get started' })).not.toBeInTheDocument();
    expect(patches(calls)).toEqual([{ checklist_hidden: true }]);
  });

  test('the welcome tour opens from the list without saving anything; Finish later keeps the step for "Continue"', async () => {
    const { user, calls } = renderApp('/candidate/dashboard', { as: 'candidate', routes: candidateRoutes(toured) });

    const list = await screen.findByRole('region', { name: 'Get started' });
    await user.click(within(list).getByRole('button', { name: 'Show the welcome tour' }));
    const guide = screen.getByRole('complementary', { name: 'Welcome tour' });
    await waitFor(() => expect(within(guide).getByRole('heading', tourStep(1, 'Make OpenDoor comfortable'))).toHaveFocus());
    await user.click(within(guide).getByRole('button', { name: 'Next' }));
    await user.click(within(guide).getByRole('button', { name: 'Finish later' }));

    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
    const again = within(list).getByRole('button', { name: 'Continue the welcome tour' });
    await waitFor(() => expect(again).toHaveFocus());
    await user.click(again);
    await waitFor(() => expect(screen.getByRole('heading', tourStep(2, 'Your starting point'))).toHaveFocus());
    expect(patches(calls)).toEqual([]);
  });

  test('the last step ends with a next step to take; a replay saves nothing', async () => {
    localStorage.setItem('opendoor.tour.2', '5');
    const { user, calls, location } = renderApp('/candidate/dashboard', { as: 'candidate', routes: candidateRoutes(toured) });

    const list = await screen.findByRole('region', { name: 'Get started' });
    await user.click(within(list).getByRole('button', { name: 'Continue the welcome tour' }));
    await waitFor(() => expect(location()).toBe('/candidate/applications'));
    const guide = screen.getByRole('complementary', { name: 'Welcome tour' });
    await waitFor(() => expect(within(guide).getByRole('heading', tourStep(6, 'Updates and ratings'))).toHaveFocus());
    await waitFor(() => expect(document.querySelector('[data-tour="notifications"]')).toHaveClass('od-tour-target'));

    await user.click(within(guide).getByRole('button', { name: 'Finish' }));
    expect(within(guide).getByRole('heading', { level: 2, name: 'That’s the quick tour!' })).toHaveFocus();
    expect(document.querySelector('.od-tour-dim')).not.toBeInTheDocument();
    expect(within(guide).getByRole('link', { name: 'Go to my profile' })).toHaveAttribute('href', '/candidate/profile');
    await user.click(within(guide).getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
    expect(localStorage.getItem('opendoor.tour.2')).toBeNull();
    expect(patches(calls)).toEqual([]);
  });

  test('gone when every step is done or the user hid it', async () => {
    const finished = { applications: { pending: 1 }, needs_count: 2, matching_jobs: 1, feedback_due: [] };
    const profile = { skills: ['Excel'], resume_url: 'https://api.opendoor.test/resume', accommodations: [{ id: 2, name: 'Accessible restroom' }] };
    renderApp('/candidate/dashboard', {
      as: 'candidate',
      routes: candidateRoutes(toured, { 'GET /candidate/dashboard': () => [200, finished], 'GET /candidate/profile': () => [200, profile] }),
    });
    // The needs card shows the same profile response the list waits for.
    expect(await screen.findByText('Accessible restroom')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Get started' })).not.toBeInTheDocument();
  });

  test('not shown when hidden', async () => {
    const { calls } = renderApp('/candidate/dashboard', { as: 'candidate', routes: candidateRoutes(done) });
    expect(await screen.findByRole('heading', { name: 'My applications' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Get started' })).not.toBeInTheDocument();
    // The profile is not loaded for a hidden list.
    expect(calls.some((call) => call.key === 'GET /candidate/profile')).toBe(false);
  });

  test('employer: company, verification and first job; the "Set up company" callout gives way to the list', async () => {
    renderApp('/employer/dashboard', {
      as: 'employer',
      routes: {
        'GET /me': () => [200, { ...users.employer, onboarding: toured }],
        'GET /employer/dashboard': () => [200, newEmployerDashboard],
      },
    });

    const list = await screen.findByRole('region', { name: 'Get started' });
    expect(within(list).getByText('1 of 4 done')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Set up company' })).toHaveAttribute('href', '/employer/company');
    expect(within(list).getByText(/after you set up your company profile/)).toBeInTheDocument();
    // Posting needs a company first (the API answers 422 without one).
    expect(within(list).queryByRole('link', { name: 'Post a job' })).not.toBeInTheDocument();
    expect(screen.queryByText(/so an administrator can verify your business/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Set up company' })).toHaveLength(1);
  });

  test('employer with a company waiting for verification and no submitted job', async () => {
    renderApp('/employer/dashboard', {
      as: 'employer',
      routes: {
        'GET /me': () => [200, { ...users.employer, onboarding: toured }],
        'GET /employer/dashboard': () => [
          200,
          { ...newEmployerDashboard, company: { exists: true, verified: false }, postings: { ...newEmployerDashboard.postings, draft: 1 } },
        ],
      },
    });

    const list = await screen.findByRole('region', { name: 'Get started' });
    expect(within(list).getByText('2 of 4 done')).toBeInTheDocument();
    expect(within(list).getByText('An administrator is checking your registration. We will notify you.')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'Post a job' })).toHaveAttribute('href', '/employer/jobs/new');
  });
});

describe('Account settings: Getting started', () => {
  test('shows the list again and replays the tour without saving it', async () => {
    const { user, calls, location } = renderApp('/account?tab=onboarding', {
      as: 'employer',
      routes: {
        'GET /me': () => [200, { ...users.employer, onboarding: done }],
        'PATCH /me/onboarding': () => [200, { tour_done: true, checklist_hidden: false }],
      },
    });

    const checkbox = await screen.findByRole('checkbox', { name: 'Show the “Get started” list on my dashboard' });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(await screen.findByText('The “Get started” list is on your dashboard until every step is done.')).toBeInTheDocument();
    expect(checkbox).toBeChecked();
    expect(patches(calls)).toEqual([{ checklist_hidden: false }]);

    await user.click(screen.getByRole('button', { name: 'Show the welcome tour' }));
    await waitFor(() => expect(location()).toBe('/employer/dashboard'));
    const guide = screen.getByRole('complementary', { name: 'Welcome tour' });
    await waitFor(() => expect(within(guide).getByRole('heading', tourStep(1, 'Make OpenDoor comfortable'))).toHaveFocus());
    await user.click(within(guide).getByRole('button', { name: 'Close the tour' }));
    expect(screen.queryByRole('complementary', { name: 'Welcome tour' })).not.toBeInTheDocument();
    expect(patches(calls)).toEqual([{ checklist_hidden: false }]);
  });

  test('a failed save puts the switch back', async () => {
    const { user } = renderApp('/account?tab=onboarding', {
      as: 'candidate',
      routes: {
        'GET /me': () => [200, { ...users.candidate, onboarding: toured }],
        'PATCH /me/onboarding': () => [500, { error: { code: 'SERVER_ERROR', message: 'Error', request_id: 'r' } }],
      },
    });

    const checkbox = await screen.findByRole('checkbox', { name: 'Show the “Get started” list on my dashboard' });
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(await screen.findByText('Your choice was not saved. Please try again.')).toBeInTheDocument();
    expect(checkbox).toBeChecked();
  });

  test('administrators have no Getting started tab', async () => {
    renderApp('/account', { as: 'admin', routes: { 'GET /me': () => [200, { ...users.admin, onboarding: null }] } });

    expect(await screen.findByRole('tab', { name: 'Display' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Getting started' })).not.toBeInTheDocument();
  });
});
