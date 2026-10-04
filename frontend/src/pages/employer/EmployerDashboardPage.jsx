import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { APPLICATION_STATUSES, POSTING_STATUSES } from '../../lib/labels.js';

/** GET /employer/dashboard – shape documented in docs/openapi.yaml (EmployerDashboard). */
export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(() => getDashboard('employer'), []);

  return (
    <Page title={`Welcome, ${user.name}`}>
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => (
          <>
            {!dashboard.company?.exists && (
              <div className="callout">
                <p>
                  <strong>Set up your company profile</strong> so an administrator can verify your business.
                </p>
                <Link className="button" to="/employer/company">
                  Set up company
                </Link>
              </div>
            )}
            {dashboard.company?.exists && !dashboard.company.verified && (
              <div className="callout">
                <p>
                  {dashboard.company.verification_rejected_reason
                    ? `Verification was not approved: ${dashboard.company.verification_rejected_reason}`
                    : 'Your business registration is waiting for verification.'}
                </p>
                <Link className="button button--secondary" to="/employer/company">
                  View company profile
                </Link>
              </div>
            )}

            <StatCards
              title="Your job postings"
              items={Object.entries(POSTING_STATUSES).map(([status, label]) => ({
                label,
                value: dashboard.postings?.[status] ?? 0,
                to: `/employer/jobs?status=${status}`,
              }))}
            />
            <StatCards
              title="Applications received"
              items={Object.entries(APPLICATION_STATUSES).map(([status, label]) => ({ label, value: dashboard.applications?.[status] ?? 0 }))}
            />
            <TrustScoreCard trustScore={dashboard.trust_score} />
          </>
        )}
      </AsyncContent>
    </Page>
  );
}
