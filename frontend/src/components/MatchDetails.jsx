import { Check, Minus, X } from 'lucide-react';
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, WORK_SETUPS } from '../lib/labels.js';
import { MATCH_LABELS, MATCH_TONES, locationText } from '../lib/match.js';
import Alert from './Alert.jsx';
import { BadgeIcon } from './StatusBadge.jsx';

const ICONS = { yes: Check, partly: Minus, no: X };
const WORDS = { yes: 'Fits', partly: 'Partly fits', no: 'Does not fit' };

/** One part of the match: an icon plus a hidden word, so the result is never shown by colour or icon alone. */
function Part({ result, title, children }) {
  const Icon = ICONS[result];
  return (
    <li className={`match-part match-part--${result}`}>
      <Icon className="match-part__icon" aria-hidden="true" focusable="false" />
      <div>
        <p className="match-part__title">
          <span className="visually-hidden">{WORDS[result]}: </span>
          {title}
        </p>
        {children && <p className="match-part__text">{children}</p>}
      </div>
    </li>
  );
}

const resultOf = (met) => (met ? 'yes' : 'no');
/** All of them, some or none. */
const shareOf = (have, total) => (have === total ? 'yes' : have > 0 ? 'partly' : 'no');

/**
 * "How this job fits you" on the job page (decision 2026-10-21): the score and each part –
 * skills, place, education, experience, work preferences and accommodation needs.
 */
export default function MatchDetails({ job }) {
  const match = job.match;
  if (!match || match.score === null || match.score === undefined) return null;

  const tone = MATCH_TONES[match.label] ?? 'neutral';
  const skills = match.skills ?? { matched: [], missing: [] };
  const skillTotal = skills.matched.length + skills.missing.length;
  const place = locationText(match.location);
  const missingNeeds = match.missing ?? [];

  return (
    <section className="card match-details" aria-labelledby="match-title">
      <h2 id="match-title">How this job fits you</h2>
      <p className="match">
        <span className={`badge badge--${tone}`}>
          <BadgeIcon tone={tone} />
          {MATCH_LABELS[match.label]}, {match.score}%
        </span>
      </p>
      <ul className="match-parts">
        {skillTotal > 0 && (
          <Part result={shareOf(skills.matched.length, skillTotal)} title={`You have ${skills.matched.length} of the ${skillTotal} skills it needs`}>
            {[skills.matched.length > 0 && `You have: ${skills.matched.join(', ')}.`, skills.missing.length > 0 && `Not in your profile: ${skills.missing.join(', ')}.`]
              .filter(Boolean)
              .join(' ')}
          </Part>
        )}
        {place && (
          <Part result={['remote', 'same_city', 'same_province'].includes(match.location.tier) ? 'yes' : match.location.tier === 'same_region' ? 'partly' : 'no'} title={place} />
        )}
        {match.education?.required && (
          <Part result={resultOf(match.education.met)} title={`Education: ${EDUCATION_LEVELS[match.education.required]} or higher`}>
            {match.education.met ? 'Your education meets this.' : 'Your profile shows less than this.'}
          </Part>
        )}
        {match.experience?.required_years && (
          <Part result={resultOf(match.experience.met)} title={`Experience: at least ${match.experience.required_years} ${match.experience.required_years === 1 ? 'year' : 'years'}`}>
            {match.experience.met ? 'Your experience meets this.' : 'Your profile shows less experience, or none.'}
          </Part>
        )}
        {match.preferences?.work_setup !== null && match.preferences?.work_setup !== undefined && (
          <Part result={resultOf(match.preferences.work_setup)} title={`${WORK_SETUPS[job.work_setup]} work`}>
            {match.preferences.work_setup ? 'One of the work setups you prefer.' : 'Not one of the work setups you chose.'}
          </Part>
        )}
        {match.preferences?.employment_type !== null && match.preferences?.employment_type !== undefined && (
          <Part result={resultOf(match.preferences.employment_type)} title={EMPLOYMENT_TYPES[job.employment_type]}>
            {match.preferences.employment_type ? 'A type of work you want.' : 'Not a type of work you chose.'}
          </Part>
        )}
        {match.total > 0 && (
          <Part result={shareOf(match.met, match.total)} title={match.met === match.total ? `Meets all ${match.total} of your needs` : `Meets ${match.met} of your ${match.total} needs`} />
        )}
      </ul>
      {missingNeeds.length > 0 && (
        <Alert type="info" className="match__missing" title={`Not mentioned in this posting: ${missingNeeds.map((need) => need.name).join(', ')}`}>
          <p>You can ask the employer about {missingNeeds.length === 1 ? 'this' : 'these'} when you apply.</p>
        </Alert>
      )}
    </section>
  );
}
