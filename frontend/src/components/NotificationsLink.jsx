import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getNotifications } from '../api/account.js';

/** Header link with the unread count (refreshed on every page change). */
export default function NotificationsLink() {
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    getNotifications()
      .then((response) => active && setUnread(response.meta?.unread_count ?? 0))
      .catch(() => active && setUnread(0)); // the count is a convenience; never block the page
    return () => {
      active = false;
    };
  }, [location.pathname]);

  return (
    <NavLink to="/notifications" className="notifications-link">
      Notifications
      {unread > 0 && (
        <span className="count-badge">
          {unread}
          <span className="visually-hidden"> unread</span>
        </span>
      )}
    </NavLink>
  );
}
