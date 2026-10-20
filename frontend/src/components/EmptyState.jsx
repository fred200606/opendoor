import MascotSad from './mascot/MascotSad.jsx';
import IconTile from './IconTile.jsx';

/**
 * Why a list is empty and what to do next (IPT look, decision 2026-10-21b): a short title, a line
 * of help and an action. With `mascot` the sad mascot sits beside the words (decoration only,
 * hidden from screen readers); otherwise an optional icon tile.
 */
export default function EmptyState({ title, icon, tone = 'lilac', mascot = false, children }) {
  return (
    <div
      className={`empty-state rounded-lg border-2 border-border bg-surface p-6 ${mascot ? 'flex flex-col items-center gap-x-6 gap-y-3 text-center sm:flex-row sm:text-left' : ''}`}
    >
      {mascot ? <MascotSad className="w-28 shrink-0" /> : icon && <IconTile icon={icon} tone={tone} />}
      <div>
        <p className="empty-state__title font-display text-lg font-bold">{title}</p>
        {children && <div className="mt-2 max-w-prose text-muted">{children}</div>}
      </div>
    </div>
  );
}
