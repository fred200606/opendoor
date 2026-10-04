import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';

export default function HomePage() {
  return (
    <Page title="Find work that fits how you work">
      <p className="lead">
        OpenDoor matches persons with disabilities with employers by the workplace accommodations they need – and lets
        hired employees confirm whether those accommodations were really provided.
      </p>
      <p className="actions">
        <Link to="/jobs" className="button">
          Browse jobs
        </Link>
        <Link to="/register" className="button button--secondary">
          Create an account
        </Link>
      </p>
    </Page>
  );
}
