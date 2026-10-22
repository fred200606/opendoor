import { useId, useState } from 'react';
import { answerHiringReport, reportHiring } from '../api/applications.js';
import { dateInManila, formatDate, todayInManila } from '../lib/format.js';
import Alert, { ApiErrorAlert } from './Alert.jsx';
import Dialog, { ConfirmDialog } from './Dialog.jsx';
import { TextField } from './form/fields.jsx';

const IN_PROGRESS = ['pending', 'reviewed', 'shortlisted', 'contacted'];
const MAX_DAYS_AHEAD = 365;

/** Words per viewer: `party` is who is looking ('candidate' or 'employer'). */
const WORDS = {
  candidate: {
    other: 'the employer',
    Other: 'The employer',
    report: 'Report that I was hired',
    intro: 'Were you hired for this job? Report it here with your start date. The employer confirms it before your application shows Hired.',
    reportedToYou: (date) => `The employer reported that you were hired, starting ${date}. Is that right?`,
    confirmText: (date) =>
      `Your application becomes Hired, starting ${date}. 30 days after the start date you can rate whether the promised accommodations were provided. You cannot undo this.`,
  },
  employer: {
    other: 'the applicant',
    Other: 'The applicant',
    report: 'Report hiring',
    intro: 'Did you hire this applicant? Report it here with the start date. The applicant confirms it before the application shows Hired.',
    reportedToYou: (date) => `The applicant reported being hired, starting ${date}. Is that right?`,
    confirmText: (date) =>
      `The application becomes Hired, starting ${date}. 30 days after the start date the applicant can rate whether you provided the promised accommodations. You cannot undo this.`,
  },
};

const DONE = {
  reported: (words) => `Reported. We asked ${words.other} to confirm it.`,
  confirm: () => 'The hire is confirmed.',
  not_yet: () => 'Your answer was sent: not yet.',
  incorrect: () => 'Your answer was sent: the report is not correct.',
};

/**
 * Hiring confirmation (Decision 2026-10-22b): either party reports the hire with a start date, the
 * other answers Confirm, Not yet (optionally with a new start date) or Incorrect. Never automatic.
 * Shows the history of every report. `onChange` gets the updated application.
 */
export default function HiringSection({ application, party, onChange }) {
  const words = WORDS[party];
  const reports = application.hiring_reports ?? [];
  const pending = reports.find((report) => report.status === 'pending');
  const canReport = IN_PROGRESS.includes(application.status) && !pending;
  const [dialog, setDialog] = useState(null); // 'report' | 'confirm' | 'not_yet' | 'incorrect'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  if (!canReport && !pending && reports.length === 0 && application.status !== 'hired') return null;

  async function run(kind, call) {
    setBusy(true);
    setError(null);
    try {
      onChange(await call());
      setMessage(DONE[kind](words));
      setDialog(null);
    } catch (apiError) {
      setError(apiError);
      // A date problem is shown in the date dialog; anything else on the page.
      if (!apiError.fieldErrors?.start_date) setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  const open = (kind) => {
    setError(null);
    setMessage('');
    setDialog(kind);
  };
  const answer = (kind, startDate) => run(kind, () => answerHiringReport(application.id, pending.id, kind, startDate));
  const dateLimits = { min: dateInManila(application.created_at), max: todayInManila(MAX_DAYS_AHEAD) };

  return (
    <section className="card hiring-card" aria-labelledby="hiring-title">
      <h2 id="hiring-title">Hiring confirmation</h2>
      {message && <Alert type="success" live="polite" title={message} />}
      {!dialog && <ApiErrorAlert error={error} title="This was not saved" />}

      {application.status === 'hired' && (
        <p>
          <strong>Hired — confirmed.</strong> {application.hire_start_date && `Start date: ${formatDate(application.hire_start_date)}.`}
        </p>
      )}

      {pending &&
        (pending.can_respond ? (
          <>
            <p>{words.reportedToYou(formatDate(pending.start_date))}</p>
            <div className="actions">
              <button type="button" className="button" onClick={() => open('confirm')}>
                Confirm
              </button>
              <button type="button" className="button button--secondary" onClick={() => open('not_yet')}>
                Not yet
              </button>
              <button type="button" className="button button--danger-outline" onClick={() => open('incorrect')}>
                Incorrect
              </button>
            </div>
          </>
        ) : (
          <p>
            You reported the hire, starting {formatDate(pending.start_date)}. Waiting for {words.other} to confirm it – nothing changes
            until then.
          </p>
        ))}

      {canReport && (
        <>
          <p>{words.intro}</p>
          <button type="button" className="button" onClick={() => open('report')}>
            {words.report}
          </button>
        </>
      )}

      {reports.length > 0 && <HiringHistory reports={reports} party={party} />}

      {dialog === 'report' && (
        <DateDialog
          title={words.report}
          label="Start date"
          hint={`The first working day. ${words.Other} is asked to confirm it.`}
          required
          submitLabel="Send report"
          limits={dateLimits}
          busy={busy}
          error={error}
          onSubmit={(date) => run('reported', () => reportHiring(application.id, date))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'not_yet' && (
        <DateDialog
          title="Not yet"
          label="New start date"
          hint="Leave it empty to keep the proposed date. The report stays open, so you can confirm it later."
          submitLabel="Send “Not yet”"
          limits={dateLimits}
          busy={busy}
          error={error}
          onSubmit={(date) => answer('not_yet', date)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'confirm' && (
        <ConfirmDialog title="Confirm the hire?" confirmLabel="Confirm" busy={busy} onConfirm={() => answer('confirm')} onClose={() => setDialog(null)}>
          <p>{words.confirmText(formatDate(pending.start_date))}</p>
        </ConfirmDialog>
      )}
      {dialog === 'incorrect' && (
        <ConfirmDialog title="Say the report is not correct?" confirmLabel="Incorrect" danger busy={busy} onConfirm={() => answer('incorrect')} onClose={() => setDialog(null)}>
          <p>The report is closed as incorrect and the application stays at its current stage. {words.Other} is notified and can report again.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}

/** A dialog with one date field; an empty optional date submits ''. */
function DateDialog({ title, label, hint, required = false, submitLabel, limits, busy, error, onSubmit, onClose }) {
  const id = useId();
  const [date, setDate] = useState('');
  const [missing, setMissing] = useState(false);
  const serverError = error?.fieldErrors?.start_date;

  function handleSubmit(event) {
    event.preventDefault();
    if (required && !date) {
      setMissing(true);
      document.getElementById(id)?.focus();
      return;
    }
    onSubmit(date);
  }

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <TextField
          id={id}
          name="start_date"
          type="date"
          label={label}
          hint={hint}
          required={required}
          value={date}
          min={limits.min}
          max={limits.max}
          error={missing ? 'Enter the start date.' : serverError}
          onChange={(event) => {
            setDate(event.target.value);
            setMissing(false);
          }}
        />
        <div className="dialog__actions">
          <button type="submit" className="button" disabled={busy}>
            {busy ? 'Please wait…' : submitLabel}
          </button>
          <button type="button" className="button button--secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const ACTIONS = {
  reported: (who, event) => `${who} reported the hire, starting ${formatDate(event.start_date)}.`,
  confirmed: (who) => `${who} confirmed the hire.`,
  not_yet: (who, event) => `${who} answered “Not yet”${event.start_date ? `, new start date ${formatDate(event.start_date)}` : ''}.`,
  disputed: (who) => `${who} said the report is not correct.`,
  cancelled: (who) => `Cancelled: ${who === 'You' ? 'you' : who.toLowerCase()} closed the application.`,
};

/** Every report and answer, oldest first, from the viewer's side ("You" / "The employer"). */
function HiringHistory({ reports, party }) {
  const who = (role) => (role === party ? 'You' : WORDS[party].Other);
  const events = reports.flatMap((report) => report.events.map((event, index) => ({ ...event, key: `${report.id}-${index}` })));

  return (
    <>
      <h3>History</h3>
      <ol className="hiring-history">
        {events.map((event) => (
          <li key={event.key}>
            <span className="hiring-history__date">{formatDate(event.created_at)}</span> {ACTIONS[event.action]?.(who(event.actor_role), event)}
          </li>
        ))}
      </ol>
    </>
  );
}
