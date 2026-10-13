import IconTile from './IconTile.jsx';

/** Figma "Empty state": a card with an optional icon tile, a short title, a line of help and an action. */
export default function EmptyState({ title, icon, tone = 'lilac', children }) {
  return (
    <div className="empty-state">
      {icon && <IconTile icon={icon} tone={tone} />}
      <p className="empty-state__title">{title}</p>
      {children}
    </div>
  );
}
