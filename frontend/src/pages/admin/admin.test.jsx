import { screen, within } from '@testing-library/react';
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
  test('approves a pending posting and rejects another with a reason', async () => {
    const { user, calls } = renderApp('/admin/job-postings', {
      as: 'admin',
      routes: {
        'GET /admin/job-postings': () => [200, paged([{ ...job, status: 'pending_approval' }])],
        'PATCH /admin/job-postings/42/approve': () => [200, { ...job, status: 'open' }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Approve Data Encoder' }));
    expect(await screen.findByText('“Data Encoder” is approved and now open.')).toBeInTheDocument();
    expect(calls.find((call) => call.key === 'PATCH /admin/job-postings/42/approve').data).toEqual({ action: 'approve' });

    await user.click(await screen.findByRole('button', { name: 'Do not approve Data Encoder' }));
    await user.type(screen.getByLabelText('Reason shown to the employer'), 'Add the working hours.');
    await user.click(screen.getByRole('button', { name: 'Save decision' }));
    await screen.findByText(/was not approved/);
    expect(calls.filter((call) => call.key === 'PATCH /admin/job-postings/42/approve').at(-1).data).toEqual({ action: 'reject', reason: 'Add the working hours.' });
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
});

describe('AdminReportsPage and AdminFeedbackPage', () => {
  test('dismisses an open report with an optional note', async () => {
    const { user, calls } = renderApp('/admin/reports', {
      as: 'admin',
      routes: {
        'GET /admin/reports': () => [200, paged([{ id: 3, job_posting_id: 42, job_posting: { id: 42, title: 'Data Encoder' }, reason: 'Fake job', status: 'open', created_at: '2026-10-04T09:00:00+08:00' }])],
        'PATCH /admin/reports/3': () => [200, { id: 3, status: 'dismissed' }],
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Dismiss: report 3' }));
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

    expect(await screen.findByText('Not delivered')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide response' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hide response' }));

    expect(await screen.findByText(/is hidden and no longer counts/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show again' })).toBeInTheDocument();
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
