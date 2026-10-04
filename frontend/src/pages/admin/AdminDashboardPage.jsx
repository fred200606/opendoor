import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { APPLICATION_STATUSES, POSTING_STATUSES } from '../../lib/labels.js';

/** GET /admin/dashboard – shape documented in docs/openapi.yaml (AdminDashboard). */
export default function AdminDashboardPage() {
  const state = useAsync(() => getDashboard('admin'), []);

  return (
    <Page title="Administration">
      <AsyncContent state={state} label="Loading analytics">
        {(dashboard) => (
          <>
            <StatCards
              title="Waiting for you"
              items={[
                { label: 'Employers to verify', value: dashboard.verification_queue ?? 0, to: '/admin/employers' },
                { label: 'Postings to approve', value: dashboard.postings?.pending_approval ?? 0, to: '/admin/job-postings' },
                { label: 'Open reports', value: dashboard.open_reports ?? 0, to: '/admin/reports' },
              ]}
            />
            <StatCards
              title="Users"
              items={[
                { label: 'Job seekers', value: dashboard.users?.candidate ?? 0, to: '/admin/users?role=candidate' },
                { label: 'Employers', value: dashboard.users?.employer ?? 0, to: '/admin/users?role=employer' },
                { label: 'Administrators', value: dashboard.users?.admin ?? 0, to: '/admin/users?role=admin' },
                { label: 'Suspended', value: dashboard.users?.suspended ?? 0 },
              ]}
            />
            <StatCards
              title="Job postings"
              items={Object.entries(POSTING_STATUSES).map(([status, label]) => ({ label, value: dashboard.postings?.[status] ?? 0 }))}
            />
            <StatCards
              title="Applications"
              items={Object.entries(APPLICATION_STATUSES).map(([status, label]) => ({ label, value: dashboard.applications?.[status] ?? 0 }))}
            />
            <StatCards
              title="Verification after hire"
              items={[
                { label: 'Feedback responses', value: dashboard.feedback?.responses ?? 0, to: '/admin/feedback' },
                { label: 'Hidden responses', value: dashboard.feedback?.hidden ?? 0 },
                { label: 'Employers with a published trust score', value: dashboard.published_trust_scores ?? 0 },
              ]}
            />
            <p>
              Manage <Link to="/admin/master-data">categories and accommodation types</Link>.
            </p>
          </>
        )}
      </AsyncContent>
    </Page>
  );
}
