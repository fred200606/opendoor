import { Accessibility, ListChecks, MessageSquare, ShieldCheck, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';
import Dialog from './Dialog.jsx';
import IconTile from './IconTile.jsx';

// Menu names in quotes match auth/navigation.js.
const STEPS = {
  candidate: [
    {
      title: 'Jobs that fit what you need',
      icon: Accessibility,
      tone: 'orange',
      text: [
        'OpenDoor lists jobs by the workplace accommodations they offer, like screen reader software, flexible hours or a sign language interpreter. We match on what you need, never on a disability.',
        'Employers see your needs only when you apply to one of their jobs.',
      ],
    },
    {
      title: 'Your needs and your profile',
      icon: ListChecks,
      tone: 'sky',
      text: [
        'Add the accommodations you need, your skills and your résumé under “Profile”.',
        'In “Find jobs”, “Matches my needs” puts the jobs that offer them first and shows how many of your needs each job meets.',
      ],
    },
    {
      title: 'Apply, then rate',
      icon: MessageSquare,
      tone: 'pink',
      text: [
        'Apply with a short cover note and ask for what you need at the interview. “Applications” shows where each one stands.',
        '30 days after you are hired, you can rate whether each promised accommodation was provided. Ratings are anonymous and build the employer’s trust score.',
      ],
    },
  ],
  employer: [
    {
      title: 'Reach job seekers with disabilities',
      icon: Accessibility,
      tone: 'orange',
      text: [
        'Job seekers on OpenDoor search by the workplace accommodations they need. Jobs that list them clearly come first for the people who need them.',
        'You see an applicant’s needs only when they apply to one of your jobs.',
      ],
    },
    {
      title: 'Set up your company and get verified',
      icon: ShieldCheck,
      tone: 'sky',
      text: [
        'Add your company profile under “Company” with your DTI or SEC registration number. An administrator checks it against the business registry.',
        'An administrator also approves each job before it goes live. We notify you of every decision.',
      ],
    },
    {
      title: 'Post jobs and earn trust',
      icon: Star,
      tone: 'pink',
      text: [
        'List the accommodations each job offers, then review applications under “Job postings”.',
        '30 days after a hire, the employee rates whether each accommodation was provided. After 3 ratings, your trust score appears on your jobs.',
      ],
    },
  ],
};

const DISPLAY_TIP =
  'Need larger text or stronger colours? Use the bar at the very top of every page. Job pages can be read aloud, and in Chrome and Edge longer text fields have a “Speak” button.';

/**
 * Onboarding welcome tour (decision 2026-10-14): three short steps for job seekers or employers
 * in a modal dialog. "Skip the tour", Escape and "Get started" all call onClose. Each step's
 * heading takes focus, so a screen reader reads the new step after Next or Back.
 * `listHint` adds a pointer to the dashboard's "Get started" list on the last step.
 */
export default function WelcomeTour({ role, listHint = false, onClose }) {
  const steps = STEPS[role] ?? STEPS.candidate;
  const [index, setIndex] = useState(0);
  const heading = useRef(null);
  const moved = useRef(false);
  const step = steps[index];
  const last = index === steps.length - 1;

  // The first step's heading gets focus from the dialog (data-autofocus); later ones from here.
  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [index]);

  function goTo(next) {
    moved.current = true;
    setIndex(next);
  }

  return (
    <Dialog
      title="Welcome to OpenDoor"
      onClose={onClose}
      actions={
        <>
          <Button className="button" onClick={last ? onClose : () => goTo(index + 1)}>
            {last ? 'Get started' : 'Next'}
          </Button>
          {index > 0 && (
            <Button className="button button--secondary" onClick={() => goTo(index - 1)}>
              Back
            </Button>
          )}
          {!last && (
            <Button className="button button--link tour__skip" onClick={onClose}>
              Skip the tour
            </Button>
          )}
        </>
      }
    >
      <div className="tour">
        <IconTile icon={step.icon} tone={step.tone} />
        <h3 ref={heading} tabIndex={-1} className="tour__title" data-autofocus>
          <span className="tour__count">
            Step {index + 1} of {steps.length}
          </span>
          <span className="visually-hidden">:</span> {step.title}
        </h3>
        <div className="wizard__progress tour__progress" aria-hidden="true">
          {steps.map((item, itemIndex) => (
            <span key={item.title} className={itemIndex <= index ? 'wizard__bar wizard__bar--done' : 'wizard__bar'} />
          ))}
        </div>
        {step.text.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {index === 0 && <p className="tour__tip">{DISPLAY_TIP}</p>}
        {last && listHint && <p className="tour__tip">The “Get started” list on your dashboard shows what to do next.</p>}
      </div>
    </Dialog>
  );
}
