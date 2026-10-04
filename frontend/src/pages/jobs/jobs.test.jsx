import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { accommodationGroups, categories, job, snapshot } from '../../test/fixtures.js';
import { apiError, paged, renderApp } from '../../test/render.jsx';

const masterData = {
  'GET /categories': () => [200, { data: categories }],
  'GET /accommodations': () => [200, { data: accommodationGroups }],
};

describe('JobSearchPage', () => {
  test('guest search announces the count and links to public details', async () => {
    const { calls } = renderApp('/jobs', {
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([job], { total: 1, match_mode: false })] },
    });

    expect(await screen.findByText('1 job found')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/jobs/42');
    expect(screen.queryByLabelText('Matches my needs')).not.toBeInTheDocument();
    const search = calls.find((call) => call.key === 'GET /job-postings');
    expect(search.config.params.get('match')).toBeNull();
  });

  test('candidate filters go into the URL and the API query', async () => {
    const { user, calls, location } = renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([job], { match_mode: true })] },
    });

    expect(await screen.findByLabelText('Matches my needs')).toBeChecked();
    await screen.findByText('Meets 1 of your 2 needs');

    await user.selectOptions(screen.getByLabelText('Category'), 'Information Technology');
    await user.click(screen.getByText(/Must offer these accommodations/));
    await user.click(screen.getByLabelText('Sign language interpreter'));
    await user.type(screen.getByLabelText('Keyword'), 'encoder');

    await waitFor(() => expect(location()).toBe('/candidate/jobs?category=3&acc=5&q=encoder'));
    const last = calls.filter((call) => call.key === 'GET /job-postings').at(-1).config.params;
    expect(Object.fromEntries(last)).toEqual({ q: 'encoder', category: '3', 'accommodations[]': '5', match: '1', sort: 'best' });
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/candidate/jobs/42');
  });

  test('candidate without needs is told to add them', async () => {
    renderApp('/candidate/jobs', {
      as: 'candidate',
      routes: { ...masterData, 'GET /job-postings': () => [200, paged([], { total: 0, match_mode: false })] },
    });

    expect(await screen.findByRole('link', { name: 'your profile' })).toHaveAttribute('href', '/candidate/profile');
    expect(screen.getByText('No jobs match these filters')).toBeInTheDocument();
  });
});

describe('JobDetailsPage', () => {
  const routes = {
    'GET /job-postings/42': () => [200, job],
    'GET /insights/job-postings/42': () => [200, snapshot],
  };

  test('shows details, notes, missing needs, trust score and the snapshot', async () => {
    renderApp('/candidate/jobs/42', { as: 'candidate', routes });

    expect(await screen.findByRole('heading', { level: 1, name: 'Data Encoder' })).toBeInTheDocument();
    expect(screen.getByText(/Ramp at main entrance/)).toBeInTheDocument();
    expect(screen.getByText('Meets 1 of your 2 needs')).toBeInTheDocument();
    expect(screen.getByText('Accessible restroom')).toBeInTheDocument();
    expect(screen.getByText('86%')).toBeInTheDocument();

    const snapshotSection = await screen.findByRole('region', { name: 'Workplace Accessibility Snapshot' });
    expect(await within(snapshotSection).findByText(/Quezon Ave. MRT Station – 220 m away, wheelchair accessible/)).toBeInTheDocument();
    expect(within(snapshotSection).getByText(/Unnamed place – 1.5 km away, partly wheelchair accessible/)).toBeInTheDocument();
  });

  test('snapshot explains failed sources in words', async () => {
    renderApp('/jobs/42', {
      routes: {
        ...routes,
        'GET /insights/job-postings/42': () => [
          200,
          { ...snapshot, location: { ...snapshot.location, precision: 'city' }, nearby_accessible: null, sources: { ...snapshot.sources, nominatim: 'unavailable', overpass: 'unavailable' } },
        ],
      },
    });

    expect(await screen.findByText(/distances are measured from the city centre/)).toBeInTheDocument();
    expect(screen.getByText(/Nearby places could not be loaded right now/)).toBeInTheDocument();
  });

  test('the job still shows when the Insights Service is down', async () => {
    renderApp('/jobs/42', {
      routes: { ...routes, 'GET /insights/job-postings/42': () => apiError(503, 'SERVICE_UNAVAILABLE') },
    });

    expect(await screen.findByText(/accessibility snapshot is not available right now/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Data Encoder' })).toBeInTheDocument();
  });

  test('guests are invited to log in to apply', async () => {
    renderApp('/jobs/42', { routes });

    expect(await screen.findByRole('link', { name: 'Log in to apply' })).toHaveAttribute('href', '/login');
  });

  test('candidate applies with an interview accommodation request', async () => {
    const { user, calls } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: { ...routes, 'POST /job-postings/42/applications': () => [201, { id: 11, job_posting_id: 42, status: 'pending' }] },
    });

    await user.type(await screen.findByLabelText(/Interview accommodation request/), 'Captions, please.');
    await user.click(screen.getByRole('button', { name: 'Send application' }));

    expect(await screen.findByText('Application sent')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'POST /job-postings/42/applications').data).toEqual({ interview_request: 'Captions, please.' });
  });

  test('a second application gets the ALREADY_APPLIED explanation', async () => {
    const { user } = renderApp('/candidate/jobs/42', {
      as: 'candidate',
      routes: { ...routes, 'POST /job-postings/42/applications': () => apiError(409, 'ALREADY_APPLIED') },
    });

    await user.click(await screen.findByRole('button', { name: 'Send application' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You have already applied to this job');
  });
});

describe('EmployerPublicPage', () => {
  test('shows company, breakdown and open jobs', async () => {
    renderApp('/employers/7', {
      routes: {
        'GET /employers/7': () => [
          200,
          {
            id: 7,
            company_name: 'Bayanihan Tech Solutions',
            verified: true,
            industry: 'Information Technology',
            address: 'Quezon City',
            description: 'We build software.',
            logo_url: null,
            trust_score: { published: true, score: 86, based_on: 5 },
            open_postings: [job],
          },
        ],
        'GET /employers/7/trust-score': () => [
          200,
          { published: true, score: 86, based_on: 5, breakdown: [{ accommodation_id: 5, name: 'Sign language interpreter', delivered: 1, partial: 1, not_delivered: 1, of: 3 }] },
        ],
      },
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Bayanihan Tech Solutions' })).toBeInTheDocument();
    expect(screen.getAllByText('Verified employer')[0]).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Sign language interpreter/ })).toHaveTextContent('1 of 3 delivered');
    expect(screen.getByRole('link', { name: 'Data Encoder' })).toHaveAttribute('href', '/jobs/42');
  });
});
