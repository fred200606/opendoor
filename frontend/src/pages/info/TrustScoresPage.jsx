import { Link } from 'react-router-dom';
import Page from '../../components/Page.jsx';

/** "How trust scores work" (linked from Home, Figma "How it works" step 3). Business rules of M7. */
export default function TrustScoresPage() {
  return (
    <Page title="How trust scores work" className="page--reading">
      <p className="lead">
        Every job lists the workplace support it offers. The trust score shows how much of that support employees hired
        through OpenDoor really received.
      </p>

      <h2>1 · Employees rate what was promised</h2>
      <p>
        From day 30 after a hire, the employee can rate each accommodation the job posting promised: <strong>delivered</strong>,{' '}
        <strong>partly delivered</strong> or <strong>not delivered</strong>. We send a reminder on that day. Each hire is rated
        once.
      </p>

      <h2>2 · We add up the answers</h2>
      <p>
        The score is the share of promised accommodations that were delivered; partly delivered counts as half. It is shown as
        a whole percent, for example "79% of promised accommodations were delivered".
      </p>

      <h2>3 · The score appears from 3 responses</h2>
      <p>
        A score is published only after at least 3 hired employees have rated the employer, so no single answer can be
        traced back to a person. Until then you see "Not published yet".
      </p>

      <h2>Fair and anonymous</h2>
      <ul>
        <li>Employers see the combined score and the count per accommodation – never who answered or how.</li>
        <li>OpenDoor administrators can hide a response that is abusive, off-topic or clearly false; the score is then recalculated.</li>
      </ul>

      <p>
        <Link to="/jobs">Browse jobs</Link> to see each employer's trust score.
      </p>
    </Page>
  );
}
