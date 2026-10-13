import { Briefcase, Check, Clock, FileText, Info, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Alert from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { APPLICATION_STATUSES, POSTING_STATUSES } from '../../lib/labels.js';

// Figma "5.1 Dashboard" (employer): an icon tile per status.
const POSTING_TILES = {
  draft: { icon: FileText, tone: 'lilac' },
  pending_approval: { icon: Clock, tone: 'orange' },
  open: { icon: Briefcase, tone: 'sky' },
  closed: { icon: X, tone: 'pink' },
};
// The three counts the design shows; there is no employer-wide applications list (decision 2026-10-13).
const APPLICATION_TILES = {
  pending: { icon: FileText, tone: 'pink' },
  reviewed: { icon: Search, tone: 'lilac' },
  hired: { icon: Check, tone: 'sky' },
};

/** GET /employer/dashboard – shape documented in docs/openapi.yaml (EmployerDashboard). */
export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(() => getDashboard('employer'), []);

  return (
    <Page title={`Welcome, ${user.name}`} subtitle={<p className="page__subtitle">Your postings, applications and trust score at a glance.</p>}>
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => {
          const waiting = dashboard.postings?.pending_approval ?? 0;
          return (
            <>
              {!dashboard.company?.exists && (
                <div className="callout">
                  <Info className="callout__icon" aria-hidden="true" focusable="false" />
                  <p>
                    <strong>Set up your company profile</strong> so an administrator can verify your business.
                  </p>
                  <Link className="button button--small" to="/employer/company">
                    Set up company
                  </Link>
                </div>
              )}
              {dashboard.company?.exists && !dashboard.company.verified && (
                <div className="callout">
                  <Info className="callout__icon" aria-hidden="true" focusable="false" />
                  <p>
                    {dashboard.company.verification_rejected_reason
                      ? `Verification was not approved: ${dashboard.company.verification_rejected_reason}`
                      : 'Your business registration is waiting for verification. Your jobs go live after an administrator checks it.'}
                  </p>
                  <Link className="button button--secondary button--small" to="/employer/company">
                    View company profile
                  </Link>
                </div>
              )}
              {/* Before verification, the callout above already says that jobs wait (Figma 16:5756). */}
              {waiting > 0 && dashboard.company?.verified && (
                <Alert type="info" className="dashboard-notice" title={waiting === 1 ? '1 job is waiting for approval.' : `${waiting} jobs are waiting for approval.`}>
                  <p>An administrator checks every job before it goes live. We will notify you.</p>
                </Alert>
              )}

              <div className="dashboard-layout dashboard-layout--employer">
                <StatCards
                  title="Your job postings"
                  items={Object.entries(POSTING_STATUSES).map(([status, label]) => ({
                    label,
                    value: dashboard.postings?.[status] ?? 0,
                    to: `/employer/jobs?status=${status}`,
                    ...POSTING_TILES[status],
                  }))}
                />
                <div className="dashboard-side">
                  <StatCards
                    title="Applications received"
                    className="stats--compact"
                    items={Object.entries(APPLICATION_TILES).map(([status, tile]) => ({
                      label: APPLICATION_STATUSES[status],
                      value: dashboard.applications?.[status] ?? 0,
                      ...tile,
                    }))}
                  />
                  <section aria-labelledby="trust-title">
                    <h2 id="trust-title">Trust score</h2>
                    <TrustScoreCard
                      trustScore={dashboard.trust_score}
                      showTitle={false}
                      link={{ to: '/employer/trust-score', label: 'See each accommodation' }}
                    />
                  </section>
                </div>
              </div>
            </>
          );
        }}
      </AsyncContent>
    </Page>
  );
}
