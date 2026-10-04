/** Previous / next paging for { current_page, last_page } meta. */
export default function Pagination({ meta, onPageChange, label = 'Pages' }) {
  if (!meta || meta.last_page <= 1) return null;
  const { current_page: page, last_page: last } = meta;

  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="button button--secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <span aria-hidden="true">← </span>Previous page
      </button>
      <p className="pagination__status">
        Page {page} of {last}
      </p>
      <button type="button" className="button button--secondary" disabled={page >= last} onClick={() => onPageChange(page + 1)}>
        Next page<span aria-hidden="true"> →</span>
      </button>
    </nav>
  );
}
