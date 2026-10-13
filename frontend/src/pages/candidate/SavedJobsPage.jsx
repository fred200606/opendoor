import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSavedJobs, unsaveJob } from '../../api/jobs.js';
import { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import JobCard from '../../components/JobCard.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import { useAsync } from '../../hooks/useAsync.js';

export default function SavedJobsPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? 1);
  const state = useAsync(() => getSavedJobs({ page }), [page]);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

  async function remove(job) {
    setError(null);
    try {
      await unsaveJob(job.id);
      state.setData((current) => ({ ...current, data: current.data.filter((item) => item.id !== job.id) }));
      setMessage(`Removed “${job.title}” from saved jobs.`);
    } catch (apiError) {
      setError(apiError);
    }
  }

  return (
    <Page title="Saved jobs">
      <p role="status" className="save-status">
        {message}
      </p>
      <ApiErrorAlert error={error} title="The job was not removed" />
      <AsyncContent state={state} label="Loading saved jobs">
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState title="No saved jobs">
              <p>
                Use “Save job” on a job’s page to keep it here. <Link to="/candidate/jobs">Find jobs</Link>
              </p>
            </EmptyState>
          ) : (
            <>
              <ul className="result-list">
                {data.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} to={`/candidate/jobs/${job.id}`} state={{ back: { to: '/candidate/saved-jobs', label: 'Back to saved jobs' } }}>
                      <button
                        type="button"
                        className="button button--secondary button--small"
                        aria-label={`Remove “${job.title}” from saved jobs`}
                        onClick={() => remove(job)}
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
