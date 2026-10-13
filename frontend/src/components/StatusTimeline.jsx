import { Check, Minus, X } from 'lucide-react';
import { formatDate } from '../lib/format.js';

const DECISIONS = {
  hired: { label: 'Hired', icon: Check, tone: 'done' },
  rejected: { label: 'Not selected', icon: X, tone: 'stopped' },
  withdrawn: { label: 'Withdrawn', icon: Minus, tone: 'stopped' },
};

/**
 * Figma "Where it stands": Submitted → Reviewed → Decision, each with its date. A step still to
 * come has a dashed circle; the one the application is waiting on is marked aria-current="step".
 * Applications reviewed before `reviewed_at` existed show the step without a date.
 */
export default function StatusTimeline({ application, waitingFor = 'Waiting for employer' }) {
  const { status } = application;
  const decision = DECISIONS[status];
  // Hired and Not selected always come after a review; a withdrawal may come before one.
  const reviewed = status === 'reviewed' || status === 'hired' || status === 'rejected' || Boolean(application.reviewed_at);

  const steps = [
    { label: 'Submitted', detail: formatDate(application.created_at), state: 'done' },
    reviewed
      ? { label: 'Reviewed', detail: application.reviewed_at ? formatDate(application.reviewed_at) : 'Done', state: 'done' }
      : status === 'withdrawn'
        ? { label: 'Reviewed', detail: 'Not reviewed', state: 'skipped' }
        : { label: 'Reviewed', detail: waitingFor, state: 'current' },
    decision
      ? {
          label: decision.label,
          detail: formatDate(status === 'hired' ? (application.hired_at ?? application.updated_at) : application.updated_at),
          state: decision.tone,
          icon: decision.icon,
        }
      : { label: 'Decision', detail: status === 'reviewed' ? waitingFor : 'After the review', state: status === 'reviewed' ? 'current' : 'upcoming' },
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
            </li>
          );
        })}
      </ol>
    </section>
  );
}
