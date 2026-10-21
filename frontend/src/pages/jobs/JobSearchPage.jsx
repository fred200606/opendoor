import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { searchJobs } from '../../api/jobs.js';
import { getAccommodationGroups, getCategories } from '../../api/masterData.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { jobPath } from '../../auth/navigation.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import FilterChips from '../../components/FilterChips.jsx';
import { TextField } from '../../components/form/fields.jsx';
import JobCard from '../../components/JobCard.jsx';
import Loading from '../../components/Loading.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import SaveJobButton from '../../components/SaveJobButton.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { plural } from '../../lib/format.js';
import { DISTANCES, SORTS, WORK_SETUPS } from '../../lib/labels.js';

/** URL query → search parameters (the URL is the single source of truth for filters). */
function readFilters(params, isCandidate) {
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    accommodations: (params.get('acc') ?? '').split(',').filter(Boolean).map(Number),
    workSetups: (params.get('setup') ?? '').split(',').filter((setup) => setup in WORK_SETUPS),
    distance: isCandidate && params.get('dist') in DISTANCES ? params.get('dist') : '',
    // Candidates see "Recommended for me" by default; they can switch it off.
    match: isCandidate ? params.get('match') !== '0' : false,
    sort: params.get('sort') ?? 'best',
    page: Number(params.get('page') ?? 1),
  };
}

/** Search for guests (/jobs) and candidates (/candidate/jobs). */
export default function JobSearchPage() {
  const { user } = useAuth();
  const isCandidate = user?.role === 'candidate';
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const backHere = { back: { to: `${location.pathname}${location.search}`, label: 'Back to job results' } };
  const filters = readFilters(params, isCandidate);

  const [keyword, setKeyword] = useState(filters.q);
  const debouncedKeyword = useDebouncedValue(keyword, 300);

  const options = useAsync(() => Promise.all([getCategories(), getAccommodationGroups()]), []);
  const results = useAsync(
    () => searchJobs({ ...filters, match: filters.match ? 1 : 0 }),
    [params.toString(), isCandidate],
  );

  function update(changes, { resetPage = true } = {}) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || (Array.isArray(value) && value.length === 0)) next.delete(key);
      else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    if (resetPage) next.delete('page');
    setParams(next, { replace: true });
  }

  // Apply the typed keyword after a short pause.
  useEffect(() => {
    if (debouncedKeyword !== (params.get('q') ?? '')) update({ q: debouncedKeyword.trim() });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedKeyword]);

  const activeCount = [filters.q, filters.category, filters.distance].filter(Boolean).length + filters.accommodations.length + filters.workSetups.length;
  const meta = results.data?.meta;
  const jobs = results.data?.data ?? [];
  const [categories, groups] = options.data ?? [[], []];

  return (
    <Page title="Find jobs">
      <p className="page__subtitle">
        {isCandidate ? 'The jobs that fit your skills, place, preferences and needs best come first.' : 'Search open jobs and filter by the support you need.'}
      </p>
      <form role="search" aria-label="Search jobs" data-tour="job-search" className="mt-6 max-w-2xl" onSubmit={(event) => event.preventDefault()}>
        <TextField
          label="Search jobs"
          voice
          name="q"
          type="search"
          hint="Job title, description or company name. Results update as you type."
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          className="mb-0 [&_.field\_\_input]:max-w-none"
        />
      </form>

      <FilterChips
        filters={filters}
        isCandidate={isCandidate}
        options={{ workSetups: WORK_SETUPS, categories, distances: isCandidate ? DISTANCES : null, sorts: SORTS, groups }}
        onChange={(changes) => update(changes)}
        activeCount={activeCount}
        onClear={() => {
          setKeyword('');
          setParams(isCandidate && !filters.match ? { match: '0' } : {}, { replace: true });
        }}
      />

      <div className="mt-6">
        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">
            Results
          </h2>
          <p className="font-display text-xl font-bold" aria-live="polite" aria-atomic="true">
            {meta && !results.loading ? `${plural(meta.total, 'job')} found` : ''}
          </p>

          {isCandidate && meta && filters.distance && meta.distance === null && (
            <Alert type="info">
              <p>
                We could not find your city on the map yet, so the distance filter is not used. Check where you live in{' '}
                <Link to="/candidate/profile?tab=about">your profile</Link>.
              </p>
            </Alert>
          )}

          <ApiErrorAlert error={results.error} title="Jobs could not be loaded" />
          {results.loading && !results.data && <Loading label="Searching jobs" />}

          {results.data && jobs.length === 0 && (
            <EmptyState title="No jobs match these filters" mascot>
              <p>Try fewer filters or a different keyword.</p>
            </EmptyState>
          )}

          <ul className="mt-4 space-y-4" aria-busy={results.loading}>
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} to={jobPath(user?.role, job.id)} state={backHere} headingLevel={3}>
                  {isCandidate && <SaveJobButton jobId={job.id} initiallySaved={Boolean(job.saved)} jobTitle={job.title} />}
                </JobCard>
              </li>
            ))}
          </ul>

          <Pagination meta={meta} onPageChange={(page) => update({ page }, { resetPage: false })} label="Result pages" />
        </section>
      </div>
    </Page>
  );
}
