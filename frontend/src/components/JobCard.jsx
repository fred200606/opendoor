import { ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, todayInManila } from '../lib/format.js';
import { EMPLOYMENT_TYPES, WORK_SETUPS } from '../lib/labels.js';
import MatchBadge from './MatchBadge.jsx';
import { VerifiedBadge } from './StatusBadge.jsx';

const SHOWN_TAGS = 3;
const DAY = 86_400_000;

/** Whole days from date `a` to date `b` (YYYY-MM-DD, Manila calendar). */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** "New" (posted in the last 3 days) and "Closing soon" (closes within 7 days). */
function labelsOf(job, today) {
  const labels = [];
  if (job.created_at && daysBetween(job.created_at.slice(0, 10), today) <= 3) labels.push('New');
  if (job.closes_at && daysBetween(today, job.closes_at) <= 7) labels.push('Closing soon');
  return labels;
}

function initials(name = '') {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

/** Joins short facts with a visible middle dot that screen readers hear as a comma. */
function DotList({ items }) {
  return items.map((item, index) => (
    <span key={item}>
      {index > 0 && (
        <>
          <span aria-hidden="true"> · </span>
          <span className="sr-only">, </span>
        </>
      )}
      {item}
    </span>
  ));
}

/**
 * The trust score in the card's corner: a shield, the number large and the number of ratings, or
 * "Not rated yet" below 3 responses. Screen readers hear "Trust score: 86%, 5 ratings".
 */
function TrustCorner({ trustScore }) {
  const scored = Boolean(trustScore?.published);
  return (
    <div className={`flex w-24 shrink-0 flex-col items-center rounded-lg border px-2 py-2 text-center ${scored ? 'border-success bg-success-soft' : 'border-border bg-subtle'}`}>
      <ShieldCheck className={`size-5 ${scored ? 'text-success' : 'text-muted'}`} aria-hidden="true" focusable="false" />
      {scored ? (
        <>
          <p className="mt-0.5 font-display text-lg leading-tight font-bold text-success">
            <span className="sr-only">Trust score: </span>
            {trustScore.score}%
          </p>
          <p className="text-xs leading-tight text-text">
            <span aria-hidden="true">trust · </span>
            {trustScore.based_on === 1 ? '1 rating' : `${trustScore.based_on} ratings`}
          </p>
        </>
      ) : (
        <p className="mt-1 text-xs leading-tight font-bold text-muted">
          <span className="sr-only">Trust score: </span>Not rated yet
        </p>
      )}
    </div>
  );
}

/**
 * One job in a list, in the IPT look (Francis Ruzgal's opendoor-ipt, decision 2026-10-21b): the
 * employer's initials, the "New" and "Closing soon" labels, the title as heading and link (it
 * stretches over the card, so the whole card opens the job with one tab stop), the employer and
 * its badge, a line of facts, the trust score in the corner, the match (candidates) and the
 * accommodations as tags with "Show more". `to` is the details link; `state` goes with it.
 * `children` (Save or Remove) sit at the right, above the stretched link.
 */
export default function JobCard({ job, to, state, headingLevel = 2, children }) {
  const Heading = `h${headingLevel}`;
  const accommodations = job.accommodations ?? [];
  const [allShown, setAllShown] = useState(false);
  const tagsId = useId();
  const more = accommodations.length - SHOWN_TAGS;
  const tags = allShown ? accommodations : accommodations.slice(0, SHOWN_TAGS);
  const facts = [WORK_SETUPS[job.work_setup], EMPLOYMENT_TYPES[job.employment_type], job.location?.label ?? job.address].filter(Boolean);
  const labels = labelsOf(job, todayInManila());

  return (
    <article className="od job-card group/card relative flex gap-4 rounded-lg border-2 border-border bg-surface p-5 transition-colors duration-200 ease-soft hover:bg-subtle has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-focus sm:p-6">
      <span
        aria-hidden="true"
        className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-primary-soft font-display text-base font-semibold text-accent"
      >
        {initials(job.employer?.company_name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {labels.length > 0 && (
              <ul aria-label="Labels" className="mb-1 flex flex-wrap gap-2">
                {labels.map((label) => (
                  <li key={label} className={`rounded-md px-2 py-0.5 text-xs font-bold ${label === 'New' ? 'bg-yellow text-text' : 'bg-warning-soft text-warning'}`}>
                    {label}
                  </li>
                ))}
              </ul>
            )}
            <Heading className="font-display text-lg font-semibold">
              <Link
                to={to}
                state={state}
                className="inline-flex min-h-11 items-center text-primary no-underline underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] group-hover/card:text-primary-hover group-hover/card:underline"
              >
                {job.title}
              </Link>
            </Heading>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {job.employer?.company_name} <VerifiedBadge verified={job.employer?.verified} />
            </p>
            {facts.length > 0 && (
              <p className="mt-1 text-sm text-muted">
                <DotList items={facts} />
              </p>
            )}
          </div>
          <TrustCorner trustScore={job.trust_score} />
        </div>

        <MatchBadge match={job.match} />

        {accommodations.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No accommodations listed.</p>
        ) : (
          <ul id={tagsId} aria-label="Accommodations offered" className="mt-3 flex flex-wrap gap-2">
            {tags.map((item) => (
              <li key={item.id} className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-sm text-accent">
                {item.name}
              </li>
            ))}
            {more > 0 && (
              <li>
                <button
                  type="button"
                  aria-expanded={allShown}
                  aria-controls={tagsId}
                  onClick={() => setAllShown(!allShown)}
                  className="group relative z-10 -my-1.5 inline-flex min-h-11 items-center"
                >
                  {/* A 44 px target around a tag-sized pill. */}
                  <span className="rounded-full border border-primary px-3 py-1 text-sm font-bold text-primary transition-colors duration-200 ease-soft group-hover:bg-primary-soft">
                    {allShown ? 'Show less' : 'Show more'}{' '}
                    <span className="sr-only">{allShown ? 'accommodations' : `accommodations, ${more} more`}</span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}

        {job.closes_at && <p className="mt-3 text-sm text-muted">Apply by {formatDate(job.closes_at)}</p>}
      </div>
      {children && <div className="relative z-10 shrink-0 self-start">{children}</div>}
    </article>
  );
}
