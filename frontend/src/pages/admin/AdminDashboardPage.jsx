import { Building2, ClipboardCheck, EyeOff, Flag, MessageSquare, ShieldCheck, TriangleAlert, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { APPLICATION_STATUSES, POSTING_STATUSES } from '../../lib/labels.js';
import { APPLICATION_TILES, POSTING_TILES } from '../../lib/statusTiles.js';

/** GET /admin/dashboard – shape documented in docs/openapi.yaml (AdminDashboard). Figma 7:3068. */
export default function AdminDashboardPage() {
  const state = useAsync(() => getDashboard('admin'), []);

  return (
    <Page title="Administration" subtitle={<p className="page__subtitle">Work queues and platform numbers.</p>}>
      <AsyncContent state={state} label="Loading analytics">
        {(dashboard) => (
          <div className="admin-dashboard">
            <StatCards
              title="Waiting for you"
              className="stats--fit"
              items={[
                { label: 'Employers to verify', value: dashboard.verification_queue ?? 0, to: '/admin/employers', linkLabel: 'Open queue', icon: Building2, tone: 'lilac' },
                { label: 'Postings to approve', value: dashboard.postings?.pending_approval ?? 0, to: '/admin/job-postings', linkLabel: 'Open queue', icon: ClipboardCheck, tone: 'sky' },
                { label: 'Open reports', value: dashboard.open_reports ?? 0, to: '/admin/reports', linkLabel: 'Open queue', icon: Flag, tone: 'orange' },
              ]}
            />
            <StatCards
              title="Users"
              className="stats--fit"
              items={[
                { label: 'Job seekers', value: dashboard.users?.candidate ?? 0, to: '/admin/users?role=candidate', icon: User, tone: 'pink' },
                { label: 'Employers', value: dashboard.users?.employer ?? 0, to: '/admin/users?role=employer', icon: Building2, tone: 'lilac' },
                { label: 'Administrators', value: dashboard.users?.admin ?? 0, to: '/admin/users?role=admin', icon: ShieldCheck, tone: 'sky' },
                { label: 'Suspended', value: dashboard.users?.suspended ?? 0, icon: TriangleAlert, tone: 'orange' },
              ]}
            />
            <StatCards
              title="Job postings"
              className="stats--fit"
              items={Object.entries(POSTING_STATUSES).map(([status, label]) => ({ label, value: dashboard.postings?.[status] ?? 0, ...POSTING_TILES[status] }))}
            />
            <StatCards
              title="Applications"
              className="stats--fit"
              items={Object.entries(APPLICATION_STATUSES).map(([status, label]) => ({ label, value: dashboard.applications?.[status] ?? 0, ...APPLICATION_TILES[status] }))}
            />
            <StatCards
              title="Verification after hire"
              className="stats--fit"
              items={[
                { label: 'Feedback responses', value: dashboard.feedback?.responses ?? 0, to: '/admin/feedback', icon: MessageSquare, tone: 'lilac' },
                { label: 'Hidden responses', value: dashboard.feedback?.hidden ?? 0, icon: EyeOff, tone: 'pink' },
                { label: 'Published trust scores', value: dashboard.published_trust_scores ?? 0, icon: ShieldCheck, tone: 'sky' },
              ]}
            />
            <p>
              Manage <Link to="/admin/master-data">categories and accommodation types</Link>
            </p>
          </div>
        )}
      </AsyncContent>
    </Page>
  );
}
