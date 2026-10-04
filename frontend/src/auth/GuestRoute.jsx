import { Navigate, Outlet } from 'react-router-dom';
import Loading from '../components/Loading.jsx';
import { useAuth } from './AuthContext.jsx';
import { homeFor } from './roles.js';

/**
 * Login and register are for guests. A logged-in user goes to the page chosen at login
 * (`afterLogin`) or to their own portal. The redirect happens here, not in the form, because
 * this route re-renders as soon as the user is set.
 */
export default function GuestRoute() {
  const { user, status, afterLogin } = useAuth();

  if (status === 'loading') return <Loading label="Checking your session" />;
  if (user) {
    return afterLogin ? (
      <Navigate to={afterLogin.pathname} state={afterLogin.state} replace />
    ) : (
      <Navigate to={homeFor(user.role)} replace />
    );
  }

  return <Outlet />;
}
