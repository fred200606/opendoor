/**
 * "Meets 3 of your 4 needs" for candidates with saved needs (`match` from the API).
 * `detailed` also lists the needs the posting does not mention.
 */
export default function MatchBadge({ match, detailed = false }) {
  if (!match || !match.total) return null;

  const full = match.met === match.total;

  return (
    <div className="match">
      <span className={`badge ${full ? 'badge--success' : 'badge--info'}`}>
        <span aria-hidden="true">{full ? '★ ' : '◐ '}</span>
        {full ? `Meets all ${match.total} of your needs` : `Meets ${match.met} of your ${match.total} needs`}
      </span>
      {detailed && match.missing?.length > 0 && (
        <div className="match__missing">
          <p>Not mentioned in this posting:</p>
          <ul>
            {match.missing.map((need) => (
              <li key={need.id}>{need.name}</li>
            ))}
          </ul>
          <p className="field__hint">You can ask the employer about these when you apply.</p>
        </div>
      )}
    </div>
  );
}
