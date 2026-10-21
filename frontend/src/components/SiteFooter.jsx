import { Link } from 'react-router-dom';

const YEAR = new Date().getFullYear();
const LINK = 'inline-flex min-h-11 items-center px-2 text-sm text-text underline-offset-4 hover:underline';

/**
 * The footer on every page (IPT look, decision 2026-10-21b): one short line of links. The
 * OpenStreetMap credit sits on the Accessibility Snapshot itself, where map data is shown.
 */
export default function SiteFooter() {
  return (
    <footer className="od border-t border-border bg-surface print:hidden">
      <nav aria-label="Footer" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-6">
          <li>
            <Link to="/privacy" className={LINK}>
              Privacy
            </Link>
          </li>
          <li>
            <Link to="/accessibility" className={LINK}>
              Accessibility statement
            </Link>
          </li>
          <li className="inline-flex min-h-11 items-center px-2 text-sm text-muted">© {YEAR} OpenDoor</li>
        </ul>
      </nav>
    </footer>
  );
}
