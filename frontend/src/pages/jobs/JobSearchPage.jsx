import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { searchJobs } from '../../api/jobs.js';
import { getAccommodationGroups, getCategories } from '../../api/masterData.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { jobPath } from '../../auth/navigation.js';
import AccommodationPicker from '../../components/AccommodationPicker.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { CheckboxField, SelectField, TextField } from '../../components/form/fields.jsx';
import JobCard from '../../components/JobCard.jsx';
import Loading from '../../components/Loading.jsx';
import Page from '../../components/Page.jsx';
import Pagination from '../../components/Pagination.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { plural } from '../../lib/format.js';
import { SORTS, toOptions } from '../../lib/labels.js';

/** URL query → search parameters (the URL is the single source of truth for filters). */
function readFilters(params, isCandidate) {
  return {
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    accommodations: (params.get('acc') ?? '').split(',').filter(Boolean).map(Number),
    // Candidates see "Matches my needs" by default; they can switch it off.
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

  const meta = results.data?.meta;
  const jobs = results.data?.data ?? [];
  const [categories, groups] = options.data ?? [[], []];

  return (
    <Page title="Find jobs">
      <p className="page__subtitle">Search open jobs and filter by the support you need.</p>
      <div className="search-layout">
        <form className="search-filters" role="search" aria-labelledby="filters-title" onSubmit={(event) => event.preventDefault()}>
          <h2 id="filters-title" className="search-filters__title">
            Filter jobs
          </h2>
          <TextField
            label="Keyword"
            voice
            name="q"
            type="search"
            hint="Job title, description or company name."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />

          {isCandidate && (
            <CheckboxField
              name="match"
              label="Matches my needs"
              hint="Show jobs that offer the accommodations in your profile first."
              checked={filters.match}
              onChange={(event) => update({ match: event.target.checked ? '' : '0' })}
            />
          )}

          <SelectField
            label="Category"
            name="category"
            placeholder="All categories"
            options={categories.map((category) => ({ value: String(category.id), label: category.name }))}
            value={filters.category}
            onChange={(event) => update({ category: event.target.value })}
          />

          <SelectField
            label="Sort by"
            name="sort"
            options={toOptions(SORTS)}
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value === 'best' ? '' : event.target.value })}
          />

          <details className="filter-details" open={filters.accommodations.length > 0}>
            <summary>Must offer these accommodations{filters.accommodations.length > 0 && ` (${filters.accommodations.length})`}</summary>
            {options.data ? (
              <AccommodationPicker
                id="filter-accommodations"
                legend="Only show jobs that offer"
                groups={groups}
                selected={filters.accommodations}
                onChange={(ids) => update({ acc: ids })}
              />
            ) : (
              <Loading label="Loading accommodations" />
            )}
          </details>

          <button
            type="button"
            className="button button--link"
            onClick={() => {
              setKeyword('');
              setParams(isCandidate && !filters.match ? { match: '0' } : {}, { replace: true });
            }}
          >
            Clear filters
          </button>
          <p className="field__hint search-filters__hint">Results update as you type.</p>
        </form>

        <section className="search-results" aria-labelledby="results-heading">
          <h2 id="results-heading" className="visually-hidden">
            Results
          </h2>
          <p className="result-count" aria-live="polite" aria-atomic="true">
            {meta && !results.loading ? `${plural(meta.total, 'job')} found` : ''}
          </p>

          {isCandidate && meta && meta.match_mode === false && filters.match && (
            <Alert type="info">
              <p>
                Add the accommodations you need to <Link to="/candidate/profile">your profile</Link> to see which jobs match
                them.
              </p>
            </Alert>
          )}

          <ApiErrorAlert error={results.error} title="Jobs could not be loaded" />
          {results.loading && !results.data && <Loading label="Searching jobs" />}

          {results.data && jobs.length === 0 && (
            <EmptyState title="No jobs match these filters">
              <p>Try fewer filters or a different keyword.</p>
            </EmptyState>
          )}

          <ul className="result-list" aria-busy={results.loading}>
            {jobs.map((job) => (
              <li key={job.id}>
                <JobCard job={job} to={jobPath(user?.role, job.id)} state={backHere} headingLevel={3} />
              </li>
            ))}
          </ul>

          <Pagination meta={meta} onPageChange={(page) => update({ page }, { resetPage: false })} label="Result pages" />
        </section>
      </div>
    </Page>
  );
}
