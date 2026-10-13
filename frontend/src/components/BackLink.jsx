import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Figma "Back link": chevron + bold underlined link above the page heading. */
export default function BackLink({ to, children }) {
  return (
    <p className="back-link">
      <Link to={to}>
        <ChevronLeft aria-hidden="true" focusable="false" />
        {children}
      </Link>
    </p>
  );
}
