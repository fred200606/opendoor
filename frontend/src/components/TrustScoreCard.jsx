import { useId } from 'react';
import { Link } from 'react-router-dom';
import { plural } from '../lib/format.js';

const MIN_RESPONSES = 3;

/**
 * Employer trust score: share of advertised accommodations that hired employees confirmed as
 * delivered. Published only from 3 responses. `breakdown` (optional) lists each accommodation;
 * `explain` adds the "How trust scores work" link.
 */
export default function TrustScoreCard({ trustScore, breakdown, headingLevel = 2, compact = false, explain = false }) {
  const Heading = `h${headingLevel}`;
  const captionId = useId();
  const basedOn = trustScore?.based_on ?? 0;
  const explainLink = explain && (
    <p className="trust-card__link">
      <Link to="/trust-scores">How trust scores work</Link>
    </p>
  );

  if (!trustScore?.published) {
    return (
      <section className={`trust-card ${compact ? 'trust-card--compact' : ''}`} aria-label="Trust score">
        {!compact && <Heading className="trust-card__title">Trust score</Heading>}
        <p>
          <strong>Not published yet.</strong> A score appears after {MIN_RESPONSES} hired employees have rated this employer
          ({basedOn} of {MIN_RESPONSES} so far).
        </p>
        {explainLink}
      </section>
    );
  }

  return (
    <section className={`trust-card ${compact ? 'trust-card--compact' : ''}`} aria-label="Trust score">
      {!compact && <Heading className="trust-card__title">Trust score</Heading>}
      <p className="trust-card__score">
        <span className="trust-card__value">{trustScore.score}%</span> of promised accommodations were delivered. Based on{' '}
        {plural(basedOn, 'response')}.
      </p>
      {explainLink}

      {breakdown?.length > 0 && (
        // Wider than a 320 px screen: the table scrolls inside its own box (WCAG 1.4.10 allows it for
        // data tables), which takes keyboard focus because the table has nothing focusable.
        <div className="table-wrap" role="region" aria-labelledby={captionId} tabIndex={0}>
          <table className="table trust-card__table">
            <caption id={captionId} className="visually-hidden">
              Each accommodation, as rated by hired employees
            </caption>
            <thead>
              <tr>
                <th scope="col">Accommodation</th>
                <th scope="col">Delivered</th>
                <th scope="col">Partly</th>
                <th scope="col">Not delivered</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.accommodation_id}>
                  <th scope="row">
                    {row.name}
                    {/* For Read aloud, which skips the number cells. */}
                    <span className="visually-hidden">
                      {' '}
                      ({row.delivered} of {row.of} delivered)
                    </span>
                  </th>
                  <td>{row.delivered}</td>
                  <td>{row.partial}</td>
                  <td>{row.not_delivered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
