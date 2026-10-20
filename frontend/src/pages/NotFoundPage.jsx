import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homeFor } from '../auth/roles.js';
import MascotSad from '../components/mascot/MascotSad.jsx';
import Page from '../components/Page.jsx';

/** Figma "3.7 Page not found", with the IPT sad mascot under his rain cloud (decision 2026-10-21b). */
export default function NotFoundPage() {
  const { user } = useAuth();

  return (
    <Page
      title="We could not find that page"
      documentTitle="Page not found"
      className="mx-auto max-w-md text-center"
      illustration={<MascotSad className="mx-auto w-40 sm:w-48" />}
      subtitle={<p className="page__subtitle">It may have moved, or the link may be wrong.</p>}
    >
      <p className="actions justify-center">
        <Link to={user ? homeFor(user.role) : '/'} className="button">
          Go to the home page
        </Link>
        <Link to={user?.role === 'candidate' ? '/candidate/jobs' : '/jobs'} className="button button--secondary">
          Browse jobs
        </Link>
      </p>
    </Page>
  );
}
