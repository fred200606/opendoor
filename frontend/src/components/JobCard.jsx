import { Accessibility, Check, ChevronDown, MapPin, Minus, ShieldCheck, X } from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { cardSkills, cityOf, qualificationSummary, salaryText } from '../lib/jobs.js';
import { companyInitials, formatDate, plural, todayInManila } from '../lib/format.js';
import { EMPLOYMENT_TYPES, WORK_SETUPS } from '../lib/labels.js';
import { MATCH_LABELS, MATCH_TONES, matchParts } from '../lib/match.js';
import { BadgeIcon, VerifiedBadge } from './StatusBadge.jsx';

const DAY = 86_400_000;
const PART_ICONS = { yes: Check, partly: Minus, no: X };
const PART_WORDS = { yes: 'Fits', partly: 'Partly fits', no: 'Does not fit' };
// Controls inside the card sit above the stretched title link.
const ABOVE = 'relative z-10';
const TEXT_LINK = `${ABOVE} font-bold text-primary underline underline-offset-4 hover:no-underline`;

/** Whole days from date `a` to date `b` (YYYY-MM-DD, Manila calendar). */
function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
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

/** "Match: 74%" with its label and a "Why this match?" disclosure listing each part (candidates). */
function CardMatch({ match, to, state, title }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (!match || match.score === null || match.score === undefined) return null;
  const tone = MATCH_TONES[match.label] ?? 'neutral';

  return (
    <div className="mt-4 rounded-md bg-subtle px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`badge badge--${tone}`}>
          <BadgeIcon tone={tone} />
          Match: {match.score}%
        </span>
        <span className="font-bold">{MATCH_LABELS[match.label]}</span>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={`${ABOVE} -my-2 inline-flex min-h-11 items-center gap-1 font-bold text-primary underline underline-offset-4 hover:no-underline`}
        >
          Why this match?
          <ChevronDown className={`size-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" focusable="false" />
        </button>
      </div>
      <div id={panelId} hidden={!open}>
        <ul className="mt-2 grid gap-1 text-sm">
          {matchParts(match).map((part) => {
            const Icon = PART_ICONS[part.result];
            return (
              <li key={part.text} className="grid grid-cols-[1rem_1fr] items-start gap-x-2">
                <Icon className={`mt-0.5 size-4 ${part.result === 'yes' ? 'text-success' : 'text-muted'}`} aria-hidden="true" focusable="false" />
                <span>
                  <span className="sr-only">{PART_WORDS[part.result]}: </span>
                  {part.text}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm">
          <Link to={`${to}#match`} state={state} className={TEXT_LINK}>
            See the full match <span className="sr-only">for {title}</span>
          </Link>
        </p>
      </div>
    </div>
  );
}

/**
 * One job in a list (Decision 2026-10-22e: what a candidate needs to judge the work comes first).
 * In order: the title (heading and link; it stretches over the card, so the whole card opens the
 * job), the employer and its badge, the salary, city · work setup · employment type, a two-line
 * summary, up to 3 required skills, the key qualifications, the match with "Why this match?"
 * (candidates), a smaller accommodation row that links to the job's accommodations, and the
 * apply-by date with "View job". The trust score sits in the corner (IPT look, decision 2026-10-21b).
 * `to` is the details link; `state` goes with it. `children` (Save or Remove) sit next to "View job".
 */
export default function JobCard({ job, to, state, headingLevel = 2, children }) {
  const Heading = `h${headingLevel}`;
  const today = todayInManila();
  const isNew = job.created_at && daysBetween(job.created_at.slice(0, 10), today) <= 3;
  const closingSoon = job.closes_at && daysBetween(today, job.closes_at) <= 7;
  const facts = [cityOf(job), WORK_SETUPS[job.work_setup], EMPLOYMENT_TYPES[job.employment_type]].filter(Boolean);
  const skills = cardSkills(job);
  const qualifications = qualificationSummary(job);
  const accommodations = job.accommodations?.length ?? 0;
  const match = job.match;
  const needs = match?.total > 0 ? (match.met === match.total ? `offers all ${match.total} of your needs` : `offers ${match.met} of your ${match.total} needs`) : null;

  return (
    <article className="od job-card group/card relative flex gap-4 rounded-lg border-2 border-border bg-surface p-5 transition-colors duration-200 ease-soft hover:bg-subtle has-[.job-card-link:focus-visible]:outline-3 has-[.job-card-link:focus-visible]:outline-focus sm:p-6">
      <span
        aria-hidden="true"
        className="hidden size-12 shrink-0 place-items-center rounded-md border border-border bg-primary-soft font-display text-base font-semibold text-accent sm:grid"
      >
        {companyInitials(job.employer?.company_name)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {isNew && <p className="mb-1 inline-block rounded-md bg-yellow px-2 py-0.5 text-xs font-bold text-text">New</p>}
            <Heading className="font-display text-lg font-semibold">
              <Link
                to={to}
                state={state}
                className="job-card-link inline-flex min-h-11 items-center text-primary no-underline underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] group-hover/card:text-primary-hover group-hover/card:underline"
              >
                {job.title}
              </Link>
            </Heading>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {job.employer?.company_name} <VerifiedBadge verified={job.employer?.verified} />
            </p>
          </div>
          <TrustCorner trustScore={job.trust_score} />
        </div>

        <p className={`mt-3 font-display text-lg font-bold ${job.salary ? 'text-text' : 'text-muted'}`}>
          <span className="sr-only">Salary: </span>
          {salaryText(job.salary)}
        </p>
        {facts.length > 0 && (
          <p className="mt-1 flex items-start gap-1.5 text-muted">
            <MapPin className="mt-1 size-4 shrink-0" aria-hidden="true" focusable="false" />
            <span>
              <DotList items={facts} />
            </span>
          </p>
        )}
        {job.description && <p className="mt-3 line-clamp-2">{job.description}</p>}

        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <dt className="font-bold">Required skills:</dt>
            {skills.shown.length === 0 ? (
              <dd className="text-muted">None listed</dd>
            ) : (
              <dd>
                <ul className="flex flex-wrap items-center gap-2">
                  {skills.shown.map((skill) => (
                    <li key={skill.name} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${skill.have ? 'border-success bg-success-soft' : 'border-border bg-subtle'}`}>
                      {skill.have && <Check className="size-3.5 text-success" aria-hidden="true" focusable="false" />}
                      {skill.name}
                      {skill.have && <span className="sr-only"> (you have it)</span>}
                    </li>
                  ))}
                  {skills.more > 0 && (
                    <li>
                      <Link to={`${to}#skills`} state={state} className={`${TEXT_LINK} inline-flex min-h-11 items-center`}>
                        +{skills.more} more<span className="sr-only">: view all skills for {job.title}</span>
                      </Link>
                    </li>
                  )}
                </ul>
              </dd>
            )}
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold">Qualifications:</dt>
            <dd className="min-w-0 flex-1 truncate">{qualifications ?? 'No minimum education or experience'}</dd>
          </div>
        </dl>

        <CardMatch match={match} to={to} state={state} title={job.title} />

        <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm text-muted">
          <Accessibility className="size-4 shrink-0" aria-hidden="true" focusable="false" />
          {accommodations === 0 ? (
            'No workplace accommodations listed'
          ) : (
            <>
              <span>
                {plural(accommodations, 'workplace accommodation')}
                {needs && `, ${needs}`}
              </span>
              <span aria-hidden="true">·</span>
              <Link to={`${to}#accommodations`} state={state} className={`${ABOVE} inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:no-underline`}>
                View accommodations <span className="sr-only">for {job.title}</span>
              </Link>
            </>
          )}
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            {job.closes_at && <span>Apply by {formatDate(job.closes_at)}</span>}
            {closingSoon && <span className="rounded-md bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">Closing soon</span>}
          </p>
          <div className={`${ABOVE} flex flex-wrap items-center gap-2`}>
            {children}
            <Link to={to} state={state} className="button button--small">
              View job<span className="sr-only">: {job.title}</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
