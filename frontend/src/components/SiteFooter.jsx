import { Link } from 'react-router-dom';

const YEAR = new Date().getFullYear();

/**
 * Figma "Footer": on every page, with the OpenStreetMap and PSGC attribution the Accessibility
 * Snapshot and the location pickers need. "Contact us" waits for real contact details (2026-10-13).
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <ul className="site-footer__links">
          <li>
            <Link to="/privacy">Privacy</Link>
          </li>
          <li>
            <Link to="/accessibility">Accessibility statement</Link>
          </li>
          <li className="site-footer__copyright">© {YEAR} OpenDoor</li>
        </ul>
        <p>
          OpenDoor – inclusive hiring for persons with disabilities. Map data © OpenStreetMap contributors. Location lists from
          the Philippine Standard Geographic Code (PSGC).
        </p>
      </div>
    </footer>
  );
}
