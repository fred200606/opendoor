import { Link } from 'react-router-dom';

/** Dashboard numbers as a labelled list (readable in order, not just a visual grid). */
export default function StatCards({ title, items, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;

  return (
    <section className="stats" aria-label={title}>
      <Heading>{title}</Heading>
      <ul className="stats__list">
        {items.map((item) => (
          <li key={item.label} className="stats__item">
            <span className="stats__value">{item.value}</span>
            <span className="stats__label">{item.to ? <Link to={item.to}>{item.label}</Link> : item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
