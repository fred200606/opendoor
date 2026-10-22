import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../../api/account.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import GetStarted from '../../components/GetStarted.jsx';
import Page from '../../components/Page.jsx';
import StatCards from '../../components/StatCards.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { showsGetStarted, useOnboarding } from '../../hooks/useOnboarding.js';
import { APPLICATION_STATUSES, POSTING_STATUSES } from '../../lib/labels.js';
import { APPLICATION_TILES, POSTING_TILES } from '../../lib/statusTiles.js';

// The stages in progress (Decision 2026-10-22a); there is no employer-wide applications list (decision 2026-10-13).
const RECEIVED = ['pending', 'reviewed', 'shortlisted', 'contacted'];

/** GET /employer/dashboard – shape documented in docs/openapi.yaml (EmployerDashboard). */
export default function EmployerDashboardPage() {
  const { user } = useAuth();
  const state = useAsync(() => getDashboard('employer'), []);
  const { onboarding } = useOnboarding();

  return (
    <Page title={`Welcome, ${user.name}`} subtitle={<p className="page__subtitle">Your postings, applications and trust score at a glance.</p>}>
      <AsyncContent state={state} label="Loading your summary">
        {(dashboard) => {
          const steps = employerSteps(dashboard);
          return (
            <>
              <GetStarted steps={steps} />
              {/* The "Get started" list has the same first step. */}
              {!dashboard.company?.exists && !showsGetStarted(onboarding, steps) && (
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
                      : 'Your business registration is waiting for verification. You can prepare jobs as drafts and publish them once an administrator has verified your company.'}
                  </p>
                  <Link className="button button--secondary button--small" to="/employer/company">
                    View company profile
                  </Link>
                </div>
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
                    items={RECEIVED.map((status) => ({
                      label: APPLICATION_STATUSES[status],
                      value: dashboard.applications?.[status] ?? 0,
                      ...APPLICATION_TILES[status],
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

/** Onboarding "Get started" steps, from the dashboard data. */
function employerSteps(dashboard) {
  const company = dashboard.company ?? {};
  const submitted = ['open', 'closed'].some((status) => (dashboard.postings?.[status] ?? 0) > 0);
  let verificationHint = 'An administrator is checking your registration. We will notify you.';
  if (!company.exists) verificationHint = 'An administrator checks your registration after you set up your company profile.';
  else if (company.verification_rejected_reason) verificationHint = 'Not approved yet. Update your company profile and it is checked again.';

  return [
    { id: 'account', title: 'Create your account', done: true },
    {
      id: 'company',
      title: 'Set up your company profile',
      done: Boolean(company.exists),
      hint: 'With your DTI or SEC registration number.',
      link: { to: '/employer/company', label: 'Set up company' },
    },
    {
      id: 'verified',
      title: 'Get your business verified',
      done: Boolean(company.verified),
      hint: verificationHint,
      link: company.exists && company.verification_rejected_reason ? { to: '/employer/company', label: 'Update company' } : undefined,
    },
    {
      id: 'post',
      title: 'Publish your first job',
      done: submitted,
      hint: 'List the skills it needs and the accommodations it offers. It goes live as soon as you publish it.',
      link: company.exists ? { to: '/employer/jobs/new', label: 'Post a job' } : undefined,
    },
  ];
}
