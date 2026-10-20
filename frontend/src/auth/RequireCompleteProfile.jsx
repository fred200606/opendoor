import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

/**
 * Job seekers complete their profile before the dashboard and the other candidate pages
 * (decision 2026-10-21). Navigation only: Core also refuses applying with PROFILE_INCOMPLETE.
 * `profile_complete` is null for other roles and missing in older sessions (treated as complete).
 */
export default function RequireCompleteProfile() {
  const { user } = useAuth();
  const location = useLocation();

  if (user?.role === 'candidate' && user.profile_complete === false) {
    return <Navigate to="/candidate/setup" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
