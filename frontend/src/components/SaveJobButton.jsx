import { Bookmark, BookmarkCheck, Check } from 'lucide-react';
import { useState } from 'react';
import { saveJob, unsaveJob } from '../api/jobs.js';
import Button from './Button.jsx';

/**
 * M12 Save / Saved toggle (aria-pressed) for job seekers, with a polite status message.
 * On job details it says "Save job" and turns solid when saved; on a result card (`jobTitle` given)
 * it says "Save" and stays outlined (Figma 5:1610), with the job title in its name so the buttons
 * of different cards can be told apart.
 */
export default function SaveJobButton({ jobId, initiallySaved, jobTitle }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const onCard = Boolean(jobTitle);

  async function toggle() {
    setBusy(true);
    try {
      if (saved) await unsaveJob(jobId);
      else await saveJob(jobId);
      setSaved(!saved);
      setMessage(saved ? 'Removed from saved jobs.' : 'Saved. Find it under Saved jobs.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const Icon = !saved ? Bookmark : onCard ? BookmarkCheck : Check;

  return (
    <>
      <Button
        type="button"
        className={`button button--small ${saved && !onCard ? '' : 'button--secondary'}`.trim()}
        aria-pressed={saved}
        disabled={busy}
        onClick={toggle}
      >
        <Icon aria-hidden="true" focusable="false" />
        {saved ? 'Saved' : onCard ? 'Save' : 'Save job'}
        {onCard && (
          <>
            {' '}
            <span className="visually-hidden">{jobTitle}</span>
          </>
        )}
      </Button>
      <p className="visually-hidden" role="status">
        {message}
      </p>
    </>
  );
}
