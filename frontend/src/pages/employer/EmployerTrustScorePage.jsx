import { Link } from 'react-router-dom';
import { getCompany, getTrustScore } from '../../api/profile.js';
import Alert from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import TrustScoreCard, { TrustBreakdownTable } from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';

/**
 * The employer's own score (Figma 6:4194): totals and per-accommodation counts only, never
 * individual responses.
 */
export default function EmployerTrustScorePage() {
  const state = useAsync(async () => {
    const company = await getCompany();
    return getTrustScore(company.id);
  }, []);

  return (
    <Page title="Trust score" subtitle={<p className="page__subtitle">Whether you keep your accommodation promises.</p>}>
      <AsyncContent state={state} label="Loading your trust score" errorTitle="Your trust score could not be loaded">
        {(trustScore) => (
          <div className="employer-layout">
            <div className="dashboard-side">
              <TrustScoreCard trustScore={trustScore} title="Your trust score" />
              <Alert type="info" title="How it works">
                <p>
                  Hired employees rate each promised accommodation 30 days after their confirmed start date. Partly delivered counts as half. Answers are
                  anonymous. A score is shown from 3 responses.
                </p>
              </Alert>
            </div>
            <section aria-labelledby="each-title">
              <h2 id="each-title">Each accommodation</h2>
              {trustScore.breakdown?.length > 0 ? (
                <TrustBreakdownTable breakdown={trustScore.breakdown} />
              ) : (
                <p>No ratings yet.</p>
              )}
              <p>
                Tip: keep your <Link to="/employer/jobs">job postings</Link> accurate to keep your score high.
              </p>
            </section>
          </div>
        )}
      </AsyncContent>
    </Page>
  );
}
