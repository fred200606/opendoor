import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { NAVIGATION } from '../auth/navigation.js';
import { ROLE_LABELS, homeFor } from '../auth/roles.js';
import NotificationsLink from './NotificationsLink.jsx';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const links = NAVIGATION[user?.role ?? 'guest'];

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="site-header">
        <div className="container site-header__inner">
          <Link to={user ? homeFor(user.role) : '/'} className="brand">
            OpenDoor
          </Link>

          <nav aria-label="Account">
            <ul className="nav-list">
              {user ? (
                <>
                  {user.role !== 'admin' && (
                    <li>
                      <NotificationsLink />
                    </li>
                  )}
                  <li>
                    <NavLink to="/account">
                      {user.name} <span className="nav-role">({ROLE_LABELS[user.role]})</span>
                    </NavLink>
                  </li>
                  <li>
                    <button type="button" className="button button--link" onClick={logout}>
                      Log out
                    </button>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <NavLink to="/login">Log in</NavLink>
                  </li>
                  <li>
                    <NavLink to="/register" className="button button--small">
                      Create account
                    </NavLink>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>

        <nav className="portal-nav" aria-label="Main">
          <ul className="container portal-nav__list">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink to={link.to}>{link.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" tabIndex={-1} className="container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>OpenDoor – inclusive hiring for persons with disabilities.</p>
          <p>
            Map data © OpenStreetMap contributors. Location lists from the Philippine Standard Geographic Code (PSGC).
          </p>
        </div>
      </footer>
    </>
  );
}
