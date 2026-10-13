import { ArrowUpRight, LogOut, Menu, User } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { NAVIGATION, NOTIFICATIONS_ICON } from '../auth/navigation.js';
import { homeFor } from '../auth/roles.js';
import { useDisplayPrefs } from '../hooks/useDisplayPrefs.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import Logo from './Logo.jsx';
import NotificationsLink from './NotificationsLink.jsx';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase();
}

function NavItem({ link }) {
  return (
    <li>
      <NavLink to={link.to} end={link.end} className="nav-item">
        {link.label}
      </NavLink>
    </li>
  );
}

function AccountLink({ user }) {
  return (
    <NavLink to="/account" className="nav-item">
      <span className="avatar" aria-hidden="true">
        {initials(user.name)}
      </span>
      Account
    </NavLink>
  );
}

/**
 * Figma "Header": links on both sides of the centred logo; one header per role. The compact
 * variant (utility bar "Compact menu", and always on narrow screens) shows the logo and a Menu
 * button that opens every link; Escape closes it and returns focus to the button.
 */
export default function SiteHeader() {
  const { user, logout } = useAuth();
  const prefs = useDisplayPrefs();
  // The full menu needs about 1,200 px at standard text size, proportionally more when larger
  // (media queries measure rem at the browser default, not at our root font size).
  const narrow = useMediaQuery(`(max-width: ${(75 * Number(prefs.textSize)) / 100}rem)`);
  const role = user?.role ?? 'guest';
  const links = NAVIGATION[role];
  const showNotifications = user && role !== 'admin';
  const home = user ? homeFor(role) : '/';

  if (prefs.menu === 'compact' || narrow) {
    return (
      <header className="site-header">
        <CompactNav user={user} links={[...links.left, ...links.right]} home={home} showNotifications={showNotifications} onLogout={logout} />
      </header>
    );
  }

  return (
    <header className="site-header">
      <nav className="site-nav site-nav--full" aria-label="Main">
        <ul className="site-nav__side">
          {links.left.map((link) => (
            <NavItem key={link.to} link={link} />
          ))}
        </ul>
        <Link to={home} className="site-nav__logo" aria-label="OpenDoor home">
          <Logo />
        </Link>
        <ul className="site-nav__side site-nav__side--right">
          {links.right.map((link) => (
            <NavItem key={link.to} link={link} />
          ))}
          {user ? (
            <>
              {showNotifications && (
                <li>
                  <NotificationsLink className="nav-item" />
                </li>
              )}
              <li>
                <AccountLink user={user} />
              </li>
              <li>
                <button type="button" className="button button--secondary button--small" onClick={logout}>
                  <LogOut aria-hidden="true" focusable="false" />
                  Log out
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/login" className="nav-item">
                  Log in
                </NavLink>
              </li>
              <li>
                <NavLink to="/register" className="button button--secondary">
                  Create account
                  <span className="button__arrow" aria-hidden="true">
                    <ArrowUpRight focusable="false" />
                  </span>
                </NavLink>
              </li>
            </>
          )}
        </ul>
      </nav>
    </header>
  );
}

function CompactNav({ user, links, home, showNotifications, onLogout }) {
  // The menu remembers the page it was opened on, so choosing a link (a new page) closes it.
  const { pathname } = useLocation();
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const panelId = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === 'Escape') {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event) {
      if (!panelRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpenOn(null);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const NotificationsIcon = NOTIFICATIONS_ICON;

  return (
    <nav className="site-nav site-nav--compact" aria-label="Main">
      <Link to={home} className="site-nav__logo" aria-label="OpenDoor home">
        <Logo />
      </Link>
      <div className="site-nav__compact-actions">
        <button
          ref={buttonRef}
          type="button"
          className="button button--secondary button--small"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          <Menu aria-hidden="true" focusable="false" />
          Menu
        </button>
        {user && <AccountLink user={user} />}
      </div>
      <div id={panelId} ref={panelRef} className="menu-panel" hidden={!open}>
        <ul className="menu-panel__list">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.to}>
                <NavLink to={link.to} end={link.end} className="menu-panel__link">
                  <Icon aria-hidden="true" focusable="false" />
                  {link.label}
                </NavLink>
              </li>
            );
          })}
          {showNotifications && (
            <li>
              <NotificationsLink className="menu-panel__link" icon={<NotificationsIcon aria-hidden="true" focusable="false" />} />
            </li>
          )}
          {user ? (
            <>
              <li>
                <NavLink to="/account" className="menu-panel__link">
                  <User aria-hidden="true" focusable="false" />
                  Account
                </NavLink>
              </li>
              <li>
                <button type="button" className="menu-panel__link" onClick={onLogout}>
                  <LogOut aria-hidden="true" focusable="false" />
                  Log out
                </button>
              </li>
            </>
          ) : (
            <>
              <li>
                <NavLink to="/login" className="menu-panel__link">
                  <User aria-hidden="true" focusable="false" />
                  Log in
                </NavLink>
              </li>
              <li>
                <NavLink to="/register" className="menu-panel__link">
                  <ArrowUpRight aria-hidden="true" focusable="false" />
                  Create account
                </NavLink>
              </li>
            </>
          )}
        </ul>
        <p className="menu-panel__hint">Escape closes the menu and returns focus to the Menu button.</p>
      </div>
    </nav>
  );
}
