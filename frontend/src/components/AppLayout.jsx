import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS, homeFor } from '../auth/roles.js';

export default function AppLayout() {
  const { user, logout } = useAuth();

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

          <nav aria-label="Main">
            <ul className="nav-list">
              {user ? (
                <>
                  <li>
                    <NavLink to={homeFor(user.role)}>Dashboard</NavLink>
                  </li>
                  <li className="nav-user">
                    {user.name} <span className="nav-role">({ROLE_LABELS[user.role]})</span>
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
      </header>

      <main id="main" tabIndex={-1} className="container">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <p>OpenDoor – inclusive hiring for persons with disabilities.</p>
        </div>
      </footer>
    </>
  );
}
