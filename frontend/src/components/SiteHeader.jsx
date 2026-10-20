import { ArrowUpRight, ChevronDown, LogIn, LogOut, Menu, Settings, User, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { NAVIGATION, NOTIFICATIONS_ICON } from '../auth/navigation.js';
import { homeFor } from '../auth/roles.js';
import { useDisplayPrefs } from '../hooks/useDisplayPrefs.js';
import Logo from './Logo.jsx';
import NotificationsLink from './NotificationsLink.jsx';

const NAV_ITEM = 'inline-flex min-h-11 items-center gap-2 whitespace-nowrap px-3 text-base transition-[box-shadow,color] duration-300 ease-soft';
// The current page is underlined in violet; hovering shows a yellow line.
const NAV_IDLE = 'text-muted hover:text-text hover:shadow-[inset_0_-3px_0_var(--od-accent-yellow)]';
const NAV_CURRENT = 'font-bold text-text shadow-[inset_0_-3px_0_var(--od-brand-primary)]';
const PANEL_ITEM = 'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left transition-colors duration-200 ease-soft';
const SECONDARY_SMALL = 'button button--secondary button--small whitespace-nowrap';
const ICON = 'size-5 shrink-0';
const GAP = 24;

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase();
}

/**
 * The link is the current page, or (`also`) its section: an employer's application page belongs
 * to Job postings and is marked aria-current="true" there, not "page".
 */
function currentOf(link, pathname) {
  if (link.end ? pathname === link.to : pathname === link.to || pathname.startsWith(`${link.to}/`)) return 'page';
  return link.also?.some((prefix) => pathname.startsWith(prefix)) ? 'true' : undefined;
}

/** The account menu's own pages for each role. */
function accountItems(role) {
  return [...(role === 'candidate' ? [{ to: '/candidate/profile', label: 'Profile', icon: User }] : []), { to: '/account', label: 'Account', icon: Settings }];
}

/**
 * The header on every page in the IPT look (Francis Ruzgal's opendoor-ipt, decision 2026-10-21b):
 * the logo on the left, the role's links after it, and the person's own on the right
 * (Notifications and one account menu). It becomes the logo and one Menu button when Compact menu
 * is on, or when the links do not fit on one line (phones, large text). A yellow line closes it.
 */
export default function SiteHeader() {
  const { user, logout } = useAuth();
  const prefs = useDisplayPrefs();
  const { pathname } = useLocation();
  const role = user?.role ?? 'guest';
  const links = role === 'candidate' ? NAVIGATION.candidate.left : [...NAVIGATION[role].left, ...NAVIGATION[role].right];
  const home = user ? homeFor(role) : '/';
  const showNotifications = Boolean(user) && role !== 'admin';

  const rowRef = useRef(null);
  const measureRef = useRef(null);
  const [tooNarrow, setTooNarrow] = useState(false);
  const canMeasure = typeof ResizeObserver !== 'undefined';

  // An invisible copy of the full row at its natural width is compared with the room there is
  // (a copy, because the real row is gone while compact). Before paint, so no flash.
  useLayoutEffect(() => {
    if (!canMeasure) return undefined;
    const row = rowRef.current;
    const copy = measureRef.current;
    function check() {
      const needed = [...copy.children].reduce((sum, part) => sum + part.offsetWidth, 0) + 2 * GAP;
      setTooNarrow(row.clientWidth > 0 && needed > row.clientWidth);
    }
    check();
    const observer = new ResizeObserver(check);
    observer.observe(row);
    observer.observe(copy);
    window.addEventListener('resize', check);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [canMeasure, role]);

  const compact = prefs.menu === 'compact' || tooNarrow;

  const accountSide = user ? (
    <>
      {showNotifications && (
        <li>
          <NotificationsLink className={`${NAV_ITEM} ${currentOf({ to: '/notifications' }, pathname) ? NAV_CURRENT : NAV_IDLE}`} icon={<NOTIFICATIONS_ICON className={ICON} aria-hidden="true" focusable="false" />} />
        </li>
      )}
      <li>
        <AccountMenu user={user} items={accountItems(role)} onLogout={logout} />
      </li>
    </>
  ) : (
    <>
      <li>
        <Link to="/login" aria-current={currentOf({ to: '/login' }, pathname)} className={`${NAV_ITEM} ${currentOf({ to: '/login' }, pathname) ? NAV_CURRENT : NAV_IDLE}`}>
          <User className={ICON} aria-hidden="true" focusable="false" />
          Log in
        </Link>
      </li>
      <li>
        <Link to="/register" className={`${SECONDARY_SMALL} group ml-2`}>
          Create account
          <ArrowPill />
        </Link>
      </li>
    </>
  );

  return (
    <header className="relative z-20 border-b-[3px] border-yellow bg-surface print:hidden">
      <div ref={rowRef} className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
        {compact ? (
          <CompactRow key="compact" home={home} links={links} user={user} role={role} showNotifications={showNotifications} onLogout={logout} />
        ) : (
          <div key="full" className="flex animate-fade-in items-center gap-6">
            <BrandLink to={home} />
            <nav aria-label="Main" className="flex flex-1 items-center gap-6">
              <ul className="flex items-center gap-1.5">
                {links.map((link) => (
                  <li key={link.to}>
                    <NavItem link={link} pathname={pathname} />
                  </li>
                ))}
              </ul>
              <ul className="ml-auto flex items-center gap-1.5">{accountSide}</ul>
            </nav>
          </div>
        )}
      </div>

      {canMeasure && (
        <div aria-hidden="true" className="pointer-events-none invisible absolute top-0 left-0 h-0 overflow-hidden">
          <div ref={measureRef} className="flex w-max items-center gap-1.5">
            <span className="inline-flex items-center gap-2 font-display text-[1.25rem] font-semibold">
              <span className="h-9 w-7" />
              OpenDoor
            </span>
            {links.map((link) => (
              <span key={link.to} className={`${NAV_ITEM} font-bold`}>
                <link.icon className={ICON} />
                {link.label}
              </span>
            ))}
            {user ? (
              <>
                {showNotifications && <span className={`${NAV_ITEM} font-bold`}>Notifications 99</span>}
                <span className={NAV_ITEM}>
                  <span className="size-8" />
                  Account
                  <ChevronDown className="size-4" />
                </span>
              </>
            ) : (
              <>
                <span className={NAV_ITEM}>Log in</span>
                <span className={SECONDARY_SMALL}>Create account</span>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/** The logo and name; the image is decorative (alt=""), the name says "OpenDoor". */
function BrandLink({ to }) {
  return (
    <Link to={to} aria-label="OpenDoor home" className="inline-flex min-h-11 shrink-0 items-center no-underline">
      <Logo />
    </Link>
  );
}

/** The orange arrow on the main call to action (decoration, gone in Quiet mode). */
export function ArrowPill() {
  return (
    <span
      aria-hidden="true"
      className="od-decoration -mr-2 inline-grid size-7 shrink-0 place-items-center rounded-full bg-orange text-text transition-transform duration-300 ease-soft group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    >
      <ArrowUpRight className="size-4" focusable="false" />
    </span>
  );
}

function NavItem({ link, pathname }) {
  const current = currentOf(link, pathname);
  const Icon = link.icon;
  return (
    <Link to={link.to} aria-current={current} className={`${NAV_ITEM} ${current ? NAV_CURRENT : NAV_IDLE}`}>
      <Icon className={ICON} aria-hidden="true" focusable="false" />
      {link.label}
    </Link>
  );
}

/** Initials in a yellow circle beside Account (decoration). */
function Avatar({ name }) {
  return (
    <span aria-hidden="true" className="inline-grid size-8 shrink-0 place-items-center rounded-full bg-yellow text-xs font-bold text-text">
      {initials(name)}
    </span>
  );
}

/** Escape and a click outside close a disclosure panel; Escape puts focus back on its button. */
function useDisclosure() {
  const { pathname } = useLocation();
  // Open on the page where it was opened: a new page closes it, without an effect.
  const [openOn, setOpenOn] = useState(null);
  const open = openOn === pathname;
  const buttonRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpenOn(null);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return { open, toggle: () => setOpenOn(open ? null : pathname), buttonRef, wrapperRef, pathname };
}

/**
 * The account menu: the initials open a panel with the person's name and email, their own pages
 * and Log out. A disclosure (button + list of links), not an ARIA menu, so links work as links.
 */
function AccountMenu({ user, items, onLogout }) {
  const { open, toggle, buttonRef, wrapperRef, pathname } = useDisclosure();
  const panelId = useId();
  const current = items.some((item) => currentOf(item, pathname));

  return (
    <div ref={wrapperRef} className="relative">
      <button ref={buttonRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle} className={`${NAV_ITEM} ${current ? NAV_CURRENT : NAV_IDLE}`}>
        <Avatar name={user.name} />
        <span>Account</span>
        <ChevronDown className={`size-4 transition-transform duration-200 ease-soft ${open ? 'rotate-180' : ''}`} aria-hidden="true" focusable="false" />
      </button>
      <div
        id={panelId}
        data-open={open}
        inert={!open}
        aria-hidden={!open}
        className="od-pop absolute right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface p-2 shadow-[0_12px_28px_rgba(36,27,58,0.16)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-3 pt-2 pb-3">
          <Avatar name={user.name} />
          <div className="min-w-0">
            <p className="font-bold">{user.name}</p>
            {user.email && <p className="text-sm break-all text-muted">{user.email}</p>}
          </div>
        </div>
        <ul className="mt-2 grid gap-0.5">
          {items.map((item) => {
            const here = currentOf(item, pathname);
            return (
              <li key={item.to}>
                <Link to={item.to} aria-current={here} className={`${PANEL_ITEM} ${here ? 'bg-selected font-bold text-accent' : 'text-text hover:bg-primary-soft'}`}>
                  <item.icon className={`${ICON} text-accent`} aria-hidden="true" focusable="false" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="mt-1 border-t border-border pt-1">
            <button type="button" onClick={onLogout} className={`${PANEL_ITEM} font-bold text-primary hover:bg-primary-soft`}>
              <LogOut className="size-4" aria-hidden="true" focusable="false" />
              Log out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

/** The logo and a Menu button that opens every link with its icon. */
function CompactRow({ home, links, user, role, showNotifications, onLogout }) {
  const { open, toggle, buttonRef, wrapperRef, pathname } = useDisclosure();
  const panelId = useId();
  const entries = [
    ...links,
    ...(user ? accountItems(role) : [{ to: '/login', label: 'Log in', icon: LogIn }, { to: '/register', label: 'Create account', icon: ArrowUpRight }]),
  ];

  return (
    <div className="flex animate-fade-in items-center justify-between gap-4">
      <BrandLink to={home} />
      <nav aria-label="Main" ref={wrapperRef} className="relative">
        <button ref={buttonRef} type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle} className={SECONDARY_SMALL}>
          <span aria-hidden="true" className="relative size-5">
            <Menu className={`absolute inset-0 size-5 transition-[opacity,rotate] duration-300 ease-soft ${open ? 'rotate-90 opacity-0' : 'opacity-100'}`} focusable="false" />
            <X className={`absolute inset-0 size-5 transition-[opacity,rotate] duration-300 ease-soft ${open ? 'opacity-100' : '-rotate-90 opacity-0'}`} focusable="false" />
          </span>
          Menu
        </button>
        <ul
          id={panelId}
          data-open={open}
          inert={!open}
          aria-hidden={!open}
          className="od-pop absolute right-0 z-30 mt-2 grid w-[min(30rem,calc(100vw-2rem))] gap-1 rounded-lg border-2 border-accent bg-surface p-3 shadow-[0_16px_32px_rgba(36,27,58,0.2)] sm:grid-cols-2"
        >
          {entries.map((entry, index) => {
            const current = currentOf(entry, pathname);
            return (
              <li key={entry.to} className="od-stagger" style={{ '--i': index }}>
                <Link to={entry.to} aria-current={current} className={`${PANEL_ITEM} ${current ? 'bg-selected font-bold text-accent' : 'text-text hover:bg-primary-soft'}`}>
                  <entry.icon className={`${ICON} text-accent`} aria-hidden="true" focusable="false" />
                  {entry.label}
                </Link>
              </li>
            );
          })}
          {showNotifications && (
            <li className="od-stagger" style={{ '--i': entries.length }}>
              <NotificationsLink
                className={`${PANEL_ITEM} ${currentOf({ to: '/notifications' }, pathname) ? 'bg-selected font-bold text-accent' : 'text-text hover:bg-primary-soft'}`}
                icon={<NOTIFICATIONS_ICON className={`${ICON} text-accent`} aria-hidden="true" focusable="false" />}
              />
            </li>
          )}
          {user && (
            <li className="od-stagger" style={{ '--i': entries.length + 1 }}>
              <button type="button" onClick={onLogout} className={`${PANEL_ITEM} font-bold text-primary hover:bg-primary-soft`}>
                <LogOut className="size-4" aria-hidden="true" focusable="false" />
                Log out
              </button>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
}
