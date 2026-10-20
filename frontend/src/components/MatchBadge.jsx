import { MATCH_LABELS, MATCH_TONES, matchSummary } from '../lib/match.js';
import { BadgeIcon } from './StatusBadge.jsx';

/**
 * How well a job fits the candidate (`match` from the API, decision 2026-10-21): the label and
 * score ("Strong match, 92%") with short reasons (skills, place, needs). Text and icon carry the
 * meaning, never the colour alone. The job page shows every part in MatchDetails.
 */
export default function MatchBadge({ match }) {
  if (!match || match.score === null || match.score === undefined) return null;

  const tone = MATCH_TONES[match.label] ?? 'neutral';
  const reasons = matchSummary(match);

  return (
    <div className="match">
      <span className={`badge badge--${tone}`}>
        <BadgeIcon tone={tone} />
        {MATCH_LABELS[match.label]}, {match.score}%
      </span>
      {reasons.length > 0 && <p className="match__reasons">{reasons.join(' · ')}</p>}
    </div>
  );
}
