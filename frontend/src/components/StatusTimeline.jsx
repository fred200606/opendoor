import { Check, Minus, X } from 'lucide-react';
import { formatDate } from '../lib/format.js';

// What each stage means (Decisions 2026-10-22a/b).
const NOTES = {
  submitted: 'Application successfully sent.',
  review: 'The employer is reviewing your profile.',
  shortlisted: 'The employer selected you for further consideration.',
  contacted: 'The employer reached out about the next steps.',
  hired: 'You and the employer both confirmed the hire.',
};

const CLOSED = {
  rejected: { label: 'Not selected', icon: X },
  withdrawn: { label: 'Withdrawn', icon: Minus },
};

const ORDER = ['pending', 'reviewed', 'shortlisted', 'contacted', 'hired'];

/**
 * "Where it stands": Submitted → Under review → Shortlisted → Contacted → Hired, each with its date
 * and what it means. A step still to come has a dashed circle; the one the application is waiting
 * on is marked aria-current="step". The employer may skip stages forward (the step then says
 * "Skipped"). Hired needs a hiring report both parties confirmed. A closed application (not selected
 * or withdrawn) ends with that instead of Hired; while the job is closed (`job_closed`) the stage
 * is kept and the waiting step says so. Applications reviewed before `reviewed_at` existed show the
 * step without a date.
 */
export default function StatusTimeline({ application, waitingFor = 'Waiting for employer' }) {
  const { status } = application;
  const closed = CLOSED[status];
  const at = ORDER.indexOf(status); // -1 when closed
  const waiting = application.job_closed ? 'Job closed' : waitingFor;
  const hiringPending = (application.hiring_reports ?? []).some((report) => report.status === 'pending');

  /** A stage before Hired: done (with its date), skipped, current or still to come. */
  function stage(index, date, { notReached, upcoming }) {
    if (date) return { state: 'done', detail: formatDate(date) };
    // Reviewed is set when the employer opens it, so a later stage without the date is an older application.
    if (at === index || (index === 1 && (at > index || status === 'rejected'))) return { state: 'done', detail: 'Done' };
    if (at > index) return { state: 'skipped', detail: 'Skipped' };
    if (closed) return { state: 'skipped', detail: notReached };
    // With a hiring report waiting, that is the current step (later stages may be skipped).
    if (at === index - 1 && !hiringPending) return { state: 'current', detail: waiting };
    return { state: 'upcoming', detail: upcoming };
  }

  const last = closed
    ? { label: closed.label, state: 'stopped', icon: closed.icon, detail: formatDate(application.updated_at) }
    : status === 'hired'
      ? {
          label: 'Hired',
          state: 'done',
          detail: application.hire_start_date ? `Start date ${formatDate(application.hire_start_date)}` : formatDate(application.hired_at),
          note: NOTES.hired,
        }
      : hiringPending
        ? { label: 'Hired', state: 'current', detail: 'Hiring confirmation pending', note: NOTES.hired }
        : at === 3
          ? { label: 'Hired', state: 'current', detail: waiting, note: NOTES.hired }
          : { label: 'Hired', state: 'upcoming', detail: 'When you and the employer both confirm it', note: NOTES.hired };

  const steps = [
    { label: 'Submitted', state: 'done', detail: formatDate(application.created_at), note: NOTES.submitted },
    { label: 'Under review', ...stage(1, application.reviewed_at, { notReached: 'Not reviewed', upcoming: 'After you apply' }), note: NOTES.review },
    { label: 'Shortlisted', ...stage(2, application.shortlisted_at, { notReached: 'Not shortlisted', upcoming: 'After the review' }), note: NOTES.shortlisted },
    { label: 'Contacted', ...stage(3, application.contacted_at, { notReached: 'Not contacted', upcoming: 'After the shortlist' }), note: NOTES.contacted },
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
