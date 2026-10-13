import { ArrowUpRight, LogOut, Menu, User } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { NAVIGATION, NOTIFICATIONS_ICON } from '../auth/navigation.js';
import { homeFor } from '../auth/roles.js';
import { useDisplayPrefs } from '../hooks/useDisplayPrefs.js';
import { useViewportWidth } from '../hooks/useViewportWidth.js';
import Logo from './Logo.jsx';
import NotificationsLink from './NotificationsLink.jsx';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase();
}

/**
 * A top menu link. `also` lists other path prefixes that belong to its section (an employer's
 * application page is part of Job postings): there it is marked aria-current="true", not "page".
 */
function NavItem({ link }) {
  const { pathname } = useLocation();
  const inSection = link.also?.some((prefix) => pathname.startsWith(prefix));

  return (
    <li>
      {inSection ? (
        <Link to={link.to} className="nav-item" aria-current="true">
          {link.label}
        </Link>
      ) : (
        <NavLink to={link.to} end={link.end} className="nav-item">
          {link.label}
        </NavLink>
      )}
    </li>
  );
}

function AccountLink({ user }) {
  return (
    <NavLink to="/account" className="nav-item">
      <span className="avatar" aria-hidden="true">
        {initials(user.name)}
      </span>
      <span className="nav-item__text">Account</span>
    </NavLink>
  );
}

/** Width (px) of a row of items: their own widths plus the flex gaps between them. */
function rowWidth(list) {
  const items = Array.from(list.children);
  const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
  return items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) + gap * Math.max(items.length - 1, 0);
}

/**
 * Figma "Header": links on both sides of the centred logo; one header per role. The compact
 * variant (utility bar "Compact menu", and whenever the full menu does not fit) shows the logo and
 * a Menu button that opens every link; Escape closes it and returns focus to the button.
 */
export default function SiteHeader() {
  const { user, logout } = useAuth();
  const prefs = useDisplayPrefs();
  const role = user?.role ?? 'guest';
  const links = NAVIGATION[role];
  const showNotifications = user && role !== 'admin';
  const home = user ? homeFor(role) : '/';

  // How wide the full menu has to be depends on the role's links, the text size, the fonts and
  // badges such as the unread count, so it is measured (before the first paint, and again whenever
  // a menu item changes size) instead of guessed: the widest side twice (the logo stays centred),
  // plus the logo, the gaps and the padding.
  const viewport = useViewportWidth();
  const measureKey = `${role}|${prefs.textSize}`;
  const [measured, setMeasured] = useState({ key: null, needed: 0, max: Infinity });
  const needed = measured.key === measureKey ? measured.needed : null;
  const measure = useCallback(
    (nav) => {
      if (!nav) return undefined;
      const update = () => {
        const [left, right] = nav.querySelectorAll('.site-nav__side');
        const style = getComputedStyle(nav);
        const width = Math.ceil(
          2 * Math.max(rowWidth(left), rowWidth(right)) +
            nav.querySelector('.site-nav__logo').getBoundingClientRect().width +
            2 * (parseFloat(style.columnGap) || 0) +
            parseFloat(style.paddingLeft) +
            parseFloat(style.paddingRight),
        );
        // The bar is never wider than its max-width (90rem), however wide the window.
        const max = parseFloat(style.maxWidth) || Infinity;
        setMeasured((current) => (current.key === measureKey && current.needed === width && current.max === max ? current : { key: measureKey, needed: width, max }));
      };
      update();
      if (typeof ResizeObserver === 'undefined') return undefined;
      const observer = new ResizeObserver(update);
      nav.querySelectorAll('.site-nav__side > li, .site-nav__logo').forEach((item) => observer.observe(item));
      return () => observer.disconnect();
    },
    [measureKey],
  );
  const tooNarrow = needed !== null && viewport > 0 && Math.min(viewport, measured.max) < needed;

  if (prefs.menu === 'compact' || tooNarrow) {
    return (
      <header className="site-header">
        <CompactNav user={user} links={[...links.left, ...links.right]} home={home} showNotifications={showNotifications} onLogout={logout} />
      </header>
    );
  }

  return (
    <header className="site-header">
      <nav ref={measure} className="site-nav site-nav--full" aria-label="Main">
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
