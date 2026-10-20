import MascotHappy from './MascotHappy.jsx';
import MascotSad from './MascotSad.jsx';

/**
 * A message with the mascot beside it, in OpenDoor's card style: `mood` "sad" for things that
 * went wrong or are missing (a suspended account, a page that isn't there, an empty list), "happy"
 * for good news (an application sent, Get started finished, ratings sent). The words carry the
 * meaning; the mascot is decoration, hidden from screen readers.
 *
 * `role`, `headingId` and `headingRef` let a page announce the message or move focus to it.
 */
export default function MascotMessage({ mood = 'sad', title, children, action, headingLevel = 2, headingId, headingRef, role, className = '' }) {
  const Heading = `h${headingLevel}`;
  const Mascot = mood === 'happy' ? MascotHappy : MascotSad;
  const tone = mood === 'happy' ? 'border-success bg-success-soft' : 'border-border bg-surface';

  return (
    <section
      role={role}
      aria-labelledby={headingId}
      className={`flex flex-col items-center gap-x-6 gap-y-3 rounded-lg border p-5 text-center sm:flex-row sm:p-6 sm:text-left ${tone} ${className}`}
    >
      <div className="w-32 shrink-0 sm:w-36">
        <Mascot className="w-full" />
      </div>
      <div className="min-w-0">
        <Heading id={headingId} ref={headingRef} tabIndex={headingRef ? -1 : undefined} className="text-2xl font-bold outline-none">
          {title}
        </Heading>
        <div className="mt-2 max-w-prose">{children}</div>
        {action && <div className="mt-4 flex flex-wrap justify-center gap-3 sm:justify-start">{action}</div>}
      </div>
    </section>
  );
}
