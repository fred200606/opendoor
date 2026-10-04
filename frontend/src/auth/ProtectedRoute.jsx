import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Loading from '../components/Loading.jsx';
import { useAuth } from './AuthContext.jsx';
import { homeFor } from './roles.js';

/**
 * <Route element={<ProtectedRoute role="employer" />}> … </Route>
 * Guests go to /login (and come back afterwards); other roles go to their own portal.
 */
export default function ProtectedRoute({ role, children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Loading label="Checking your session" />;

  if (!user && status === 'signedOut') return <Navigate to="/" replace />;

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;

  return children ?? <Outlet />;
}
