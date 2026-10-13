import { useId } from 'react';
import { Link } from 'react-router-dom';
import IconTile from './IconTile.jsx';

/**
 * Dashboard numbers as a labelled list of tiles (Figma "Stat tile"; readable in order, not just a
 * visual grid). An item with `to` gets a "View" link that covers the whole tile, named
 * "View Submitted (2)". `icon` (Lucide) and `tone` add the coloured icon tile.
 */
export default function StatCards({ title, items, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  const headingId = useId();

  return (
    <section className="stats" aria-labelledby={headingId}>
      <Heading id={headingId}>{title}</Heading>
      <ul className="stats__list">
        {items.map((item) => (
          <li key={item.label} className="stats__item">
            {item.icon && <IconTile icon={item.icon} tone={item.tone} />}
            <span className="stats__value">{item.value}</span>
            <span className="stats__label">{item.label}</span>
            {item.to && (
              <Link to={item.to} className="stats__link stats__view">
                View <span className="visually-hidden">{item.label} ({item.value})</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
