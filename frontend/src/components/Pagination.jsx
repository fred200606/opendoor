import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button.jsx';

/**
 * Previous / next paging for { current_page, last_page } meta (Figma "Pagination"). The design
 * hides Previous on the first page and Next on the last; here they stay, marked unavailable, so a
 * keyboard user who just pressed one is not dropped at the top of the page.
 */
export default function Pagination({ meta, onPageChange, label = 'Pages' }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: page, last_page: last } = meta;

  return (
    <nav className="pagination" aria-label={label}>
      <Button type="button" className="button button--secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft aria-hidden="true" focusable="false" />
        Previous page
      </Button>
      <p className="pagination__status">
        Page {page} of {last}
      </p>
      <Button type="button" className="button button--secondary" disabled={page >= last} onClick={() => onPageChange(page + 1)}>
        Next page
        <ChevronRight aria-hidden="true" focusable="false" />
      </Button>
    </nav>
  );
}
