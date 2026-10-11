import { plural } from '../lib/format.js';

/**
 * "12 users" for a paged list, announced after every load – also "0 users" when a filter leaves
 * nothing (WCAG 4.1.3). Render it outside <AsyncContent>: a live region that is added already
 * filled, or removed for the empty state, is not read out. At 0 the text is only for screen
 * readers, as the page shows its own empty state.
 */
export default function ResultCount({ state, one, many }) {
  const total = state.loading ? undefined : state.data?.meta?.total;

  return (
    <p className={total === 0 ? 'visually-hidden' : undefined} role="status">
      {total === undefined ? '' : plural(total, one, many)}
    </p>
  );
}
