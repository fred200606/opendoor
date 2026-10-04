import Page from '../components/Page.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../auth/roles.js';

/** Portal landing page; the role-specific dashboards (M8) replace this in Phase 8. */
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <Page title={`Welcome, ${user.name}`}>
      <p>You are logged in as {ROLE_LABELS[user.role].toLowerCase()}.</p>
    </Page>
  );
}
