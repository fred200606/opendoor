import { Check, Minus, X } from 'lucide-react';
import { formatDate } from '../lib/format.js';

// What each stage means (Decision 2026-10-22a).
const NOTES = {
  submitted: 'Application successfully sent.',
  review: 'The employer is reviewing your profile.',
  shortlisted: 'The employer selected you for further consideration.',
  contacted: 'The employer reached out about the next steps.',
};

const CLOSED = {
  rejected: { label: 'Not selected', icon: X },
  withdrawn: { label: 'Withdrawn', icon: Minus },
};

const REVIEWED = ['reviewed', 'shortlisted', 'contacted', 'rejected'];

/**
 * "Where it stands": Submitted → Under review → Shortlisted → Contacted, each with its date and
 * what it means. A step still to come has a dashed circle; the one the application is waiting on is
 * marked aria-current="step". The employer may contact without shortlisting first (that step then
 * says "Skipped"). A closed application (not selected or withdrawn) ends with that instead of
 * Contacted. Applications reviewed before `reviewed_at` existed show the step without a date.
 */
export default function StatusTimeline({ application, waitingFor = 'Waiting for employer' }) {
  const { status } = application;
  const closed = CLOSED[status];
  const reviewed = REVIEWED.includes(status) || Boolean(application.reviewed_at);
  const shortlisted = status === 'shortlisted' || Boolean(application.shortlisted_at);

  const review = reviewed
    ? { state: 'done', detail: application.reviewed_at ? formatDate(application.reviewed_at) : 'Done' }
    : status === 'withdrawn'
      ? { state: 'skipped', detail: 'Not reviewed' }
      : { state: 'current', detail: waitingFor };

  const shortlist = shortlisted
    ? { state: 'done', detail: application.shortlisted_at ? formatDate(application.shortlisted_at) : 'Done' }
    : status === 'reviewed'
      ? { state: 'current', detail: waitingFor }
      : status === 'pending'
        ? { state: 'upcoming', detail: 'After the review' }
        : { state: 'skipped', detail: status === 'contacted' ? 'Skipped' : 'Not shortlisted' };

  const last = closed
    ? { label: closed.label, state: 'stopped', icon: closed.icon, detail: formatDate(application.updated_at) }
    : status === 'contacted'
      ? { label: 'Contacted', state: 'done', detail: formatDate(application.contacted_at ?? application.updated_at), note: NOTES.contacted }
      : status === 'shortlisted'
        ? { label: 'Contacted', state: 'current', detail: waitingFor, note: NOTES.contacted }
        : { label: 'Contacted', state: 'upcoming', detail: 'After the shortlist', note: NOTES.contacted };

  const steps = [
    { label: 'Submitted', state: 'done', detail: formatDate(application.created_at), note: NOTES.submitted },
    { label: 'Under review', ...review, note: NOTES.review },
    { label: 'Shortlisted', ...shortlist, note: NOTES.shortlisted },
    last,
  ];

  return (
    <section className="card timeline-card" aria-labelledby="timeline-title">
      <h2 id="timeline-title">Where it stands</h2>
      <ol className="timeline">
        {steps.map((step) => {
          const Icon = step.icon ?? (step.state === 'done' ? Check : null);
          return (
            <li key={step.label} className={`timeline__step timeline__step--${step.state}`} aria-current={step.state === 'current' ? 'step' : undefined}>
              <span className="timeline__mark" aria-hidden="true">
                {Icon && <Icon focusable="false" />}
              </span>
              <span className="timeline__label">{step.label}</span>
              <span className="timeline__detail">{step.detail}</span>
              {step.note && step.state !== 'skipped' && <span className="timeline__note">{step.note}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
