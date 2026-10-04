import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { EMPLOYMENT_TYPES, WORK_SETUPS } from '../lib/labels.js';
import MatchBadge from './MatchBadge.jsx';
import { VerifiedBadge } from './StatusBadge.jsx';

const MAX_TAGS = 4;

/** One search result. `to` is the details link (public or candidate portal). */
export default function JobCard({ job, to, headingLevel = 2, children }) {
  const Heading = `h${headingLevel}`;
  const accommodations = job.accommodations ?? [];

  return (
    <article className="job-card">
      <Heading className="job-card__title">
        <Link to={to}>{job.title}</Link>
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
      <p className="job-card__footer">
        {job.trust_score?.published ? <span>Trust score {job.trust_score.score}%</span> : <span>Trust score not published yet</span>}
        {job.closes_at && <span>Apply by {formatDate(job.closes_at)}</span>}
      </p>
      {children}
    </article>
  );
}
