import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSavedJobs, saveJob, unsaveJob } from '../../api/jobs.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import JobCard from '../../components/JobCard.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import { useAsync } from '../../hooks/useAsync.js';

/** Figma 5:2831 / 15:6323: bookmarks, newest first; a removal can be undone right away. */
export default function SavedJobsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => getSavedJobs({ page }), [page]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [removed, setRemoved] = useState(null); // { job, index } of the last removal, for Undo
  const [focusTarget, setFocusTarget] = useState(null);
  const undoRef = useRef(null);

  // The removed card's button is gone, so focus goes to Undo; after Undo, back to that card's Remove.
  // (A new object each time, so a second removal moves focus again.)
  useEffect(() => {
    if (focusTarget?.id === 'undo') undoRef.current?.focus();
    else if (focusTarget) document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget]);

  async function remove(job, index) {
    setError(null);
    try {
      await unsaveJob(job.id);
      state.setData((current) => ({ ...current, data: current.data.filter((item) => item.id !== job.id) }));
      setRemoved({ job, index });
      setMessage(`Removed “${job.title}” from saved jobs.`);
      setFocusTarget({ id: 'undo' });
    } catch (apiError) {
      setError(apiError);
    }
  }

  async function undo() {
    const { job, index } = removed;
    setError(null);
    try {
      await saveJob(job.id);
      state.setData((current) => {
        const data = [...current.data];
        data.splice(Math.min(index, data.length), 0, job);
        return { ...current, data };
      });
      setRemoved(null);
      setMessage(`“${job.title}” is back in your saved jobs.`);
      setFocusTarget({ id: `remove-${job.id}` });
    } catch (apiError) {
      setError(apiError);
    }
  }

  return (
    <Page title="Saved jobs" subtitle={<p className="page__subtitle">Jobs you bookmarked, newest first.</p>}>
      <div className="undo-bar">
        <div role="status" className="undo-bar__message">
          {message && <Alert type="success" title={message} />}
        </div>
        {removed && (
          <button ref={undoRef} type="button" className="button button--secondary button--small" onClick={undo}>
            Undo <span className="visually-hidden">removing “{removed.job.title}”</span>
          </button>
        )}
      </div>
      <ApiErrorAlert error={error} title={removed ? 'The job was not put back' : 'The job was not removed'} />
      <AsyncContent state={state} label="Loading saved jobs">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No saved jobs" mascot>
              <p>Use “Save job” on a job’s page to keep it here.</p>
              <Link className="button" to="/candidate/jobs">
                Find jobs
              </Link>
            </EmptyState>
          ) : (
            <>
              <ul className="result-list">
                {data.map((job, index) => (
                  <li key={job.id}>
                    <JobCard job={job} to={`/candidate/jobs/${job.id}`} state={{ back: { to: '/candidate/saved-jobs', label: 'Back to saved jobs' } }}>
                      <button
                        id={`remove-${job.id}`}
                        type="button"
                        className="button button--secondary button--small"
                        aria-label={`Remove “${job.title}” from saved jobs`}
                        onClick={() => remove(job, index)}
                      >
                        Remove
                      </button>
                    </JobCard>
                  </li>
                ))}
              </ul>
              <Pagination meta={meta} onPageChange={(next) => setParams({ page: String(next) }, { replace: true })} />
            </>
          )
        }
      </AsyncContent>
    </Page>
  );
}
