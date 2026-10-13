import Alert from './Alert.jsx';
import { BadgeIcon } from './StatusBadge.jsx';

/**
 * "Meets 3 of your 4 needs" for candidates with saved needs (`match` from the API).
 * `detailed` also names the needs the posting does not mention (Figma info alert).
 */
export default function MatchBadge({ match, detailed = false }) {
  if (!match || !match.total) return null;

  const full = match.met === match.total;
  const tone = full ? 'success' : 'info';
  const missing = match.missing ?? [];

  return (
    <div className="match">
      <span className={`badge badge--${tone}`}>
        <BadgeIcon tone={tone} />
        {full ? `Meets all ${match.total} of your needs` : `Meets ${match.met} of your ${match.total} needs`}
      </span>
      {detailed && missing.length > 0 && (
        <Alert type="info" className="match__missing" title={`Not mentioned in this posting: ${missing.map((need) => need.name).join(', ')}`}>
          <p>You can ask the employer about {missing.length === 1 ? 'this' : 'these'} when you apply.</p>
        </Alert>
      )}
    </div>
  );
}
