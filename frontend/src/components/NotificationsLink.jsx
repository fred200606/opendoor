import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { getNotifications } from '../api/account.js';
import { NOTIFICATIONS_CHANGED } from '../lib/notifications.js';

/** Header link with the unread count (refreshed on every page change and after notificationsChanged()). */
export default function NotificationsLink() {
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () =>
      getNotifications()
        .then((response) => active && setUnread(response.meta?.unread_count ?? 0))
        .catch(() => active && setUnread(0)); // the count is a convenience; never block the page
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [location.pathname]);

  return (
    // The name comes from the content ("Notifications 2 unread") so it starts with the visible
    // text "Notifications 2" (WCAG 2.5.3 Label in Name – voice control users say what they see).
    <NavLink to="/notifications" className="notifications-link">
      Notifications
      {unread > 0 && (
        <>
          {' '}
          <span className="count-badge">{unread}</span>{' '}
          <span className="visually-hidden">unread</span>
        </>
      )}
    </NavLink>
  );
}
