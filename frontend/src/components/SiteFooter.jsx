import { Link } from 'react-router-dom';

const YEAR = new Date().getFullYear();
const LINK = 'inline-flex min-h-11 items-center px-2 text-sm text-muted underline-offset-4 hover:text-text hover:underline';

/**
 * The footer on every page (IPT look, decision 2026-10-21b), with the OpenStreetMap and PSGC
 * attribution the Accessibility Snapshot and the location pickers need.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface print:hidden">
      <nav aria-label="Footer" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-4">
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
        <p className="mt-1 text-center text-xs text-muted">
          OpenDoor – inclusive hiring for persons with disabilities. Map data © OpenStreetMap contributors. Location lists from the Philippine Standard
          Geographic Code (PSGC). Look and mascot after opendoor-ipt by Francis Ruzgal.
        </p>
      </nav>
    </footer>
  );
}
