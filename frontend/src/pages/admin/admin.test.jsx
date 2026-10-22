import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { job } from '../../test/fixtures.js';
import { apiError, paged, renderApp, users, validationError } from '../../test/render.jsx';

const employer = {
  id: 7,
  company_name: 'Bayanihan Tech Solutions',
  verified: false,
  industry: 'Information Technology',
  address: '123 Quezon Ave.',
  location: { psgc_code: '1381300000', label: 'Quezon City, NCR' },
  business_reg_no: 'DTI-123456',
  registry_type: 'DTI',
  verified_at: null,
  verification_rejected_reason: null,
  owner: { id: 4, name: 'Ana Reyes', email: 'employer@opendoor.test' },
  latest_registry_check: null,
};

describe('AdminEmployerPage', () => {
  test('registry check result is shown and a weak name match is highlighted', async () => {
    const { user, calls } = renderApp('/admin/employers/7', {
      as: 'admin',
      routes: {
        'GET /admin/employers/7': () => [200, employer],
        'PATCH /admin/employers/7/verify': () => [
          200,
          { registry: { status: 'ACTIVE', registered_name: 'BAYANIHAN TECH', name_match: 0.72, checked_at: '2026-10-04T10:00:00+08:00' }, verified_at: null },
        ],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Check with the business registry' }));

    expect(await screen.findByText('The registry check is done.')).toBeInTheDocument();
    expect(screen.getByText(/matches “Bayanihan Tech Solutions” only 72% \(below 80%\)/)).toBeInTheDocument();
    expect(screen.getByText('BAYANIHAN TECH')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /admin/employers/7/verify').data).toEqual({ action: 'check' });
  });

  test('registry outage is explained and manual decision stays possible', async () => {
    const { user } = renderApp('/admin/employers/7', {
      as: 'admin',
      routes: {
        'GET /admin/employers/7': () => [200, employer],
        'PATCH /admin/employers/7/verify': () => apiError(502, 'REGISTRY_UNAVAILABLE'),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Check with the business registry' }));

    expect(await screen.findByText(/did not respond. You can try again later or decide manually/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).not.toHaveAttribute('aria-disabled');
  });

  test('rejecting needs a reason, which is sent to the API', async () => {
    const { user, calls } = renderApp('/admin/employers/7', {
      as: 'admin',
      routes: {
        'GET /admin/employers/7': () => [200, employer],
        'PATCH /admin/employers/7/verify': () => [200, { registry: null, verified_at: null }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Do not approve' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save decision' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a reason.');

    await user.type(within(dialog).getByLabelText('Reason shown to the employer'), 'Registration number not found.');
    await user.click(within(dialog).getByRole('button', { name: 'Save decision' }));

    expect(await screen.findByText(/was not approved. The employer can see your reason/)).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /admin/employers/7/verify').data).toEqual({ action: 'reject', reason: 'Registration number not found.' });
  });

  test('approving gives the Verified badge', async () => {
    const { user } = renderApp('/admin/employers/7', {
      as: 'admin',
      routes: {
        'GET /admin/employers/7': () => [200, employer],
        'PATCH /admin/employers/7/verify': () => [200, { registry: null, verified_at: '2026-10-04T10:00:00+08:00' }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Approve' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));

    expect(await screen.findByText('Bayanihan Tech Solutions is now verified.')).toBeInTheDocument();
    expect(screen.getByText('Verified employer')).toBeInTheDocument();
  });

  test('the queue lists pending employers by default', async () => {
    const { calls } = renderApp('/admin/employers', {
      as: 'admin',
      routes: { 'GET /admin/employers': () => [200, paged([{ ...employer, latest_registry_check: { status: 'NOT_FOUND' } }])] },
    });

    expect(await screen.findByRole('link', { name: 'Bayanihan Tech Solutions' })).toHaveAttribute('href', '/admin/employers/7');
    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'GET /admin/employers').config.params.status).toBe('pending');
  });
});

describe('AdminPostingsPage', () => {
  test('lists every posting without approval buttons; the filter narrows to one status', async () => {
    const { user, calls } = renderApp('/admin/job-postings', {
      as: 'admin',
      routes: { 'GET /admin/job-postings': () => [200, paged([{ ...job, status: 'open' }])] },
    });

    expect(await screen.findByRole('button', { name: 'Remove Data Encoder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve/ })).not.toBeInTheDocument();
    expect(calls.find((call) => call.key === 'GET /admin/job-postings').config.params.status).toBeUndefined();
    expect(screen.getByLabelText('Show')).toHaveValue('');

    await user.selectOptions(screen.getByLabelText('Show'), 'Closed');
    await waitFor(() => expect(calls.filter((call) => call.key === 'GET /admin/job-postings').at(-1).config.params.status).toBe('closed'));
  });

  test('removes an open posting only with a reason', async () => {
    let removed = false;
    const { user, calls } = renderApp('/admin/job-postings?status=open', {
      as: 'admin',
      routes: {
        'GET /admin/job-postings': () => [200, paged(removed ? [] : [{ ...job, status: 'open' }])],
        'DELETE /admin/job-postings/42': () => {
          removed = true;
          return [204, ''];
        },
      },
    });

    expect(await screen.findByRole('button', { name: 'Remove Data Encoder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve Data Encoder' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Data Encoder' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove posting' }));
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent('Enter a reason.');
    expect(calls.some((call) => call.key === 'DELETE /admin/job-postings/42')).toBe(false);

    await user.type(screen.getByLabelText('Reason shown to the employer'), 'False accommodation claims.');
    await user.click(screen.getByRole('button', { name: 'Remove posting' }));

    expect(await screen.findByText('“Data Encoder” was removed. The employer was told why.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'DELETE /admin/job-postings/42').data).toEqual({ reason: 'False accommodation claims.' });
    expect(await screen.findByText('No postings here')).toBeInTheDocument();
  });
});

describe('AdminUsersPage', () => {
  test('suspends another user but never offers it for the own account', async () => {
    const { user, calls } = renderApp('/admin/users', {
      as: 'admin',
      routes: {
        'GET /admin/users': () => [200, paged([users.admin, users.candidate])],
        'PATCH /admin/users/2/suspend': () => [200, { ...users.candidate, is_active: false }],
      },
    });

    expect(await screen.findByText('This is you')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suspend Maria Santos' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('signed out on every device');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Suspend' }));

    expect(await screen.findByRole('button', { name: 'Reactivate Maria Santos' })).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /admin/users/2/suspend').data).toEqual({ suspended: true });
  });

  test('suspending an employer explains that the postings are hidden, only for employers', async () => {
    const { user } = renderApp('/admin/users', {
      as: 'admin',
      routes: { 'GET /admin/users': () => [200, paged([users.candidate, users.employer, { ...users.employer, id: 5, name: 'Jose Cruz', is_active: false }])] },
    });

    await user.click(await screen.findByRole('button', { name: 'Suspend Ana Reyes' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Their job postings are hidden from candidates while the account is suspended.');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Reactivate Jose Cruz' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Their open job postings will be shown to candidates again.');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Suspend Maria Santos' }));
    expect(screen.getByRole('dialog')).not.toHaveTextContent('job postings');
  });
});

describe('AdminReportsPage and AdminFeedbackPage', () => {
  test('resolved reports show the date and the admin note', async () => {
    renderApp('/admin/reports?status=dismissed', {
      as: 'admin',
      routes: {
        'GET /admin/reports': () => [
          200,
          paged([
            { id: 3, job_posting_id: 42, job_posting: { id: 42, title: 'Data Encoder' }, reason: 'Fake job', status: 'dismissed', note: 'Checked with the employer.', resolved_at: '2026-10-06T10:00:00+08:00', created_at: '2026-10-04T09:00:00+08:00' },
            { id: 4, job_posting_id: 43, job_posting: { id: 43, title: 'Chat Support' }, reason: 'Odd', status: 'dismissed', note: null, resolved_at: '2026-10-07T10:00:00+08:00', created_at: '2026-10-05T09:00:00+08:00' },
          ]),
        ],
      },
    });

    expect(await screen.findByText('Resolved October 6, 2026 – note: Checked with the employer.')).toBeInTheDocument();
    expect(screen.getByText('Resolved October 7, 2026 – no note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Dismiss/ })).not.toBeInTheDocument();
  });

  test('dismisses an open report with an optional note', async () => {
    const { user, calls } = renderApp('/admin/reports', {
      as: 'admin',
      routes: {
        'GET /admin/reports': () => [200, paged([{ id: 3, job_posting_id: 42, job_posting: { id: 42, title: 'Data Encoder' }, reason: 'Fake job', status: 'open', created_at: '2026-10-04T09:00:00+08:00' }])],
        'PATCH /admin/reports/3': () => [200, { id: 3, status: 'dismissed' }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Dismiss: report on Data Encoder, October 4, 2026' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dismiss' }));

    expect(await screen.findByText('The report was dismissed.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /admin/reports/3').data).toEqual({ status: 'dismissed' });
  });

  test('hides a feedback response (anonymous: no author shown)', async () => {
    const { user, calls } = renderApp('/admin/feedback', {
      as: 'admin',
      routes: {
        'GET /admin/feedback': () => [
          200,
          paged([
            {
              id: 9,
              employer: { id: 7, company_name: 'Bayanihan Tech' },
              job_title: 'Data Encoder',
              is_hidden: false,
              comments: 'Abusive text',
              items: [{ accommodation_id: 5, name: 'Sign language interpreter', rating: 'not_delivered' }],
              created_at: '2026-10-04T09:00:00+08:00',
            },
          ]),
        ],
        'PATCH /admin/feedback/9/hide': () => [204, ''],
      },
    });

    expect(await screen.findByText('Sign language interpreter: Not delivered')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide response: Data Encoder at Bayanihan Tech, October 4, 2026' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hide response' }));

    expect(await screen.findByText(/is hidden and no longer counts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show again: Data Encoder at Bayanihan Tech, October 4, 2026' })).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /admin/feedback/9/hide').data).toEqual({ hidden: true });
  });
});

describe('AdminMasterDataPage', () => {
  const routes = {
    'GET /categories': () => [200, { data: [{ id: 1, name: 'Administrative' }] }],
    'GET /admin/accommodations': () => [
      200,
      {
        data: [
          { id: 1, name: 'Wheelchair-accessible entrance', group: 'physical_access', description: null, is_retired: false },
          { id: 9, name: 'Fax relay', group: 'communication', description: null, is_retired: true },
        ],
      },
    ],
  };

  test('a category in use cannot be deleted and the server reason is shown', async () => {
    const { user } = renderApp('/admin/master-data', {
      as: 'admin',
      routes: {
        ...routes,
        'DELETE /admin/categories/1': () => validationError({ category: ['This category is used by job postings and cannot be deleted. Rename it instead.'] }),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Delete Administrative' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete category' }));

    expect(await screen.findByText(/used by job postings and cannot be deleted/)).toBeInTheDocument();
  });

  test('deleting an accommodation in use explains that it was retired', async () => {
    const { user } = renderApp('/admin/master-data', {
      as: 'admin',
      routes: {
        ...routes,
        'DELETE /admin/accommodations/1': () => [200, { id: 1, name: 'Wheelchair-accessible entrance', group: 'physical_access', is_retired: true }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Delete Wheelchair-accessible entrance' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText(/so it was retired instead/)).toBeInTheDocument();
  });

  test('restores a retired accommodation and adds a new one', async () => {
    const { user, calls } = renderApp('/admin/master-data', {
      as: 'admin',
      routes: {
        ...routes,
        'PUT /admin/accommodations/9': () => [200, { id: 9, name: 'Fax relay', group: 'communication', is_retired: false }],
        'POST /admin/accommodations': () => [201, { id: 20, name: 'Quiet room', group: 'physical_access', description: null, is_retired: false }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Restore Fax relay' }));
    expect(await screen.findByText('“Fax relay” is available again.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PUT /admin/accommodations/9').data).toEqual({ name: 'Fax relay', group: 'communication', description: null, is_retired: false });

    await user.click(screen.getByRole('button', { name: 'Add accommodation type' }));
    const dialog = screen.getByRole('dialog', { name: 'Add accommodation type' });
    await user.type(within(dialog).getByLabelText(/Name/), 'Quiet room');
    await user.selectOptions(within(dialog).getByLabelText(/Group/), 'Physical access');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('“Quiet room” was added.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'POST /admin/accommodations').data).toEqual({ name: 'Quiet room', group: 'physical_access', description: null });
  });
});

describe('AdminDashboardPage', () => {
  const weeks = Array.from({ length: 12 }, (_, index) => ({
    week_start: new Date(Date.UTC(2026, 7, 3 + index * 7)).toISOString().slice(0, 10),
    applications: index + 1,
    hires: index === 11 ? 2 : 0,
    new_accounts: 1,
  }));
  const dashboard = {
    verification_queue: 1,
    open_reports: 2,
    users: { candidate: 14, employer: 5, admin: 1, suspended: 0 },
    postings: { draft: 1, open: 3, closed: 1 },
    applications: { pending: 1, reviewed: 1, shortlisted: 0, contacted: 0, hired: 6, rejected: 0, withdrawn: 0 },
    feedback: { responses: 9, hidden: 0 },
    published_trust_scores: 2,
    analytics: {
      weeks,
      funnel: { submitted: 20, reviewed: 15, shortlisted: 8, contacted: 6, hired: 5 },
      needs: {
        job_seekers: 10,
        open_jobs: 4,
        top: [
          { accommodation_id: 1, name: 'Wheelchair-accessible entrance', job_seekers: 6, open_jobs: 1 },
          { accommodation_id: 5, name: 'Sign language interpreter', job_seekers: 3, open_jobs: 0 },
        ],
      },
      delivery: { delivered: 6, partial: 3, not_delivered: 1 },
    },
  };

  test('work queues link to their lists; every group shows its counts', async () => {
    renderApp('/admin/dashboard', { as: 'admin', routes: { 'GET /admin/dashboard': () => [200, dashboard] } });

    expect(await screen.findByRole('link', { name: 'Open queue Employers to verify (1)' })).toHaveAttribute('href', '/admin/employers');
    expect(screen.queryByText('Postings to approve')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open queue Open reports (2)' })).toHaveAttribute('href', '/admin/reports');
    const verification = screen.getByRole('region', { name: 'Verification after hire' });
    expect(within(verification).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '9Feedback responsesView Feedback responses (9)',
      '0Hidden responses',
      '2Published trust scores',
    ]);
  });

  test('charts print their numbers and each has a table view (Decision 2026-10-22d)', async () => {
    const { user } = renderApp('/admin/dashboard', { as: 'admin', routes: { 'GET /admin/dashboard': () => [200, dashboard] } });

    const activity = await screen.findByRole('figure', { name: 'Activity, last 12 weeks' });
    expect(activity).toHaveTextContent('78 applications, 2 confirmed hires and 12 new accounts.');
    const slider = within(activity).getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuetext', 'Week of October 19, 2026. Use the arrow keys to read each week.');
    slider.focus();
    await user.keyboard('{ArrowLeft}');
    expect(slider).toHaveAttribute('aria-valuetext', 'Week of October 12, 2026: Applications 11, Confirmed hires 0');

    await user.click(within(activity).getByRole('button', { name: 'Show as a table' }));
    const table = within(activity).getByRole('table', { name: /Activity per week/ });
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect([...within(table).getAllByRole('row')[12].children].map((cell) => cell.textContent)).toEqual(['October 19, 2026', '12', '2', '1']);
    expect(within(activity).getByRole('button', { name: 'Hide the table' })).toHaveAttribute('aria-expanded', 'true');

    const funnel = screen.getByRole('figure', { name: 'How far applications get' });
    expect([...funnel.querySelectorAll('.bar-row__value')].map((value) => value.textContent)).toEqual(['20 · 100%', '15 · 75%', '8 · 40%', '6 · 30%', '5 · 25%']);

    const delivery = screen.getByRole('figure', { name: 'Were the promised accommodations delivered?' });
    expect(delivery.querySelector('.chart-hero')).toHaveTextContent('60%');
    expect(delivery).toHaveTextContent('Partly delivered: 30% (3)');
    expect(delivery).toHaveTextContent('Not delivered: 10% (1)');

    const needs = screen.getByRole('figure', { name: 'Most needed accommodations' });
    const first = within(needs).getAllByRole('listitem').find((item) => item.textContent.startsWith('Wheelchair-accessible entrance'));
    expect(first).toHaveTextContent('Job seekers who need it: 60% (6)');
    expect(first).toHaveTextContent('Open jobs that offer it: 25% (1)');
  });

  test('an empty platform explains each chart instead of drawing it', async () => {
    renderApp('/admin/dashboard', {
      as: 'admin',
      routes: {
        'GET /admin/dashboard': () => [
          200,
          {
            ...dashboard,
            analytics: {
              weeks: weeks.map((week) => ({ ...week, applications: 0, hires: 0, new_accounts: 0 })),
              funnel: { submitted: 0, reviewed: 0, shortlisted: 0, contacted: 0, hired: 0 },
              needs: { job_seekers: 0, open_jobs: 0, top: [] },
              delivery: { delivered: 0, partial: 0, not_delivered: 0 },
            },
          },
        ],
      },
    });

    expect(await screen.findByText('No applications or hires in the last 12 weeks yet.')).toBeInTheDocument();
    expect(screen.getByText('No applications yet.')).toBeInTheDocument();
    expect(screen.getByText('No ratings yet. Hired employees can rate 30 days after their start date.')).toBeInTheDocument();
    expect(screen.getByText('No job seeker has saved an accommodation need yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show as a table' })).not.toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
});
