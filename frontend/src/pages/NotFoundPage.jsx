import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';

export default function NotFoundPage() {
  return (
    <Page title="Page not found">
      <p>We could not find that page. It may have moved, or the link may be wrong.</p>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
    </Page>
  );
}
