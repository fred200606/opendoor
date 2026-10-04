import { Link } from 'react-router-dom';
import { getCompany, getTrustScore } from '../../api/profile.js';
import AsyncContent from '../../components/AsyncContent.jsx';
import Page from '../../components/Page.jsx';
import TrustScoreCard from '../../components/TrustScoreCard.jsx';
import { useAsync } from '../../hooks/useAsync.js';

/** The employer's own score: totals and per-accommodation counts only, never individual responses. */
export default function EmployerTrustScorePage() {
  const state = useAsync(async () => {
    const company = await getCompany();
    return getTrustScore(company.id);
  }, []);

  return (
    <Page title="Your trust score">
      <p>
        Thirty days after a hire, the employee rates each accommodation your posting promised: delivered, partly delivered
        or not delivered. The score is the share delivered (partly delivered counts as half). Ratings are anonymous and
        the score is published from 3 responses.
      </p>
      <AsyncContent
        state={state}
        label="Loading your trust score"
        errorTitle="Your trust score could not be loaded"
      >
        {(trustScore) => <TrustScoreCard trustScore={trustScore} breakdown={trustScore.breakdown} />}
      </AsyncContent>
      <p>
        Improve your score by delivering every accommodation you list, and by adding details in your{' '}
        <Link to="/employer/jobs">job postings</Link>.
      </p>
    </Page>
  );
}
