import { Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { EMPLOYMENT_TYPES, WORK_SETUPS } from '../lib/labels.js';
import IconTile from './IconTile.jsx';
import MatchBadge from './MatchBadge.jsx';
import { VerifiedBadge } from './StatusBadge.jsx';

const MAX_TAGS = 3;
const TONES = ['orange', 'pink', 'lilac'];

/**
 * One search result (Figma "Job card"). `to` is the details link (public or candidate portal);
 * `state` goes with it (e.g. where the job page's back link returns to).
 * `children` (e.g. Save or Remove) sit at the right of the card.
 */
export default function JobCard({ job, to, state, headingLevel = 2, children }) {
  const Heading = `h${headingLevel}`;
  const accommodations = job.accommodations ?? [];
  const footer = [
    job.trust_score?.published
      ? `Trust score ${job.trust_score.score}%`
      : `Trust score not published yet${job.trust_score?.based_on != null ? ` (${job.trust_score.based_on} of 3 responses)` : ''}`,
    job.closes_at && `Apply by ${formatDate(job.closes_at)}`,
  ].filter(Boolean);

  return (
    <article className="job-card">
      <div className="job-card__inner">
        <IconTile icon={Briefcase} tone={TONES[Math.abs(job.id - 1) % TONES.length]} />
        <div className="job-card__content">
          <Heading className="job-card__title">
            <Link to={to} state={state}>
              {job.title}
            </Link>
          </Heading>
          <p className="job-card__employer">
            {job.employer?.company_name} <VerifiedBadge verified={job.employer?.verified} />
          </p>
          <p className="job-card__meta">
            {[EMPLOYMENT_TYPES[job.employment_type], WORK_SETUPS[job.work_setup], job.location?.label ?? job.address].filter(Boolean).join(' · ')}
          </p>
          <MatchBadge match={job.match} />
          {accommodations.length > 0 && (
            <>
              <p className="visually-hidden">Accommodations offered:</p>
              <ul className="tag-list">
                {accommodations.slice(0, MAX_TAGS).map((item) => (
                  <li key={item.id} className="tag">
                    {item.name}
                  </li>
                ))}
                {accommodations.length > MAX_TAGS && <li className="tag tag--more">+{accommodations.length - MAX_TAGS} more</li>}
              </ul>
            </>
          )}
          <p className="job-card__footer">{footer.join(' · ')}</p>
        </div>
        {children && <div className="job-card__action">{children}</div>}
      </div>
    </article>
  );
}
