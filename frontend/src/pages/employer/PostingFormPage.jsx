import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createPosting, getJob, updatePosting } from '../../api/jobs.js';
import { getCompany } from '../../api/profile.js';
import { getAccommodationGroups, getCategories } from '../../api/masterData.js';
import AccommodationPicker from '../../components/AccommodationPicker.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { RadioGroup, SelectField, TextArea, TextField } from '../../components/form/fields.jsx';
import LocationPicker from '../../components/LocationPicker.jsx';
import Page from '../../components/Page.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import WizardProgress from '../../components/WizardProgress.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate, todayInManila } from '../../lib/format.js';
import { EMPLOYMENT_TYPES, INTERVIEW_FORMATS, WORK_SETUPS, toOptions } from '../../lib/labels.js';

const FIELDS = {
  ...Object.fromEntries(
    ['title', 'description', 'category_id', 'address', 'location_psgc', 'employment_type', 'work_setup', 'interview_format', 'closes_at', 'accommodations'].map(
      (name) => [name, { id: name }],
    ),
  ),
  // "Your company must be verified…" belongs to the Publish button.
  submit: { id: 'posting-publish' },
};

// Figma "5.4 Post a new job": four steps, one request at the end. A verified company's job goes
// live when it is published; there is no approval step (decision 2026-10-21).
const STEPS = [
  { title: 'Job basics', intro: 'Your job goes live as soon as you publish it.', fields: ['title', 'category_id', 'employment_type', 'work_setup'] },
  { title: 'Description and place', intro: 'Describe the work and where it happens.', fields: ['description', 'interview_format', 'address', 'location_psgc', 'closes_at'] },
  { title: 'Accommodations', intro: 'Tell people what support you offer.', fields: ['accommodations'] },
  { title: 'Review and publish', intro: 'Check everything, then publish the job.', fields: [] },
];
const REVIEW = STEPS.length - 1;

/** The step that shows a field (accommodations.0.note → Accommodations); others stay on Review. */
function stepOf(field) {
  if (field.startsWith('accommodations')) return 2;
  const index = STEPS.findIndex((step) => step.fields.includes(field));
  return index === -1 ? REVIEW : index;
}

/** Checks a step before moving on; the server checks everything again when the posting is saved. */
function checkStep(index, values) {
  const errors = {};
  if (index === 0) {
    if (!values.title.trim()) errors.title = ['Enter a job title.'];
    if (!values.category_id) errors.category_id = ['Choose a category.'];
    if (!values.employment_type) errors.employment_type = ['Choose an employment type.'];
    if (!values.work_setup) errors.work_setup = ['Choose a work setup.'];
  }
  if (index === 1) {
    if (!values.description.trim()) errors.description = ['Describe the job.'];
    if (!values.interview_format) errors.interview_format = ['Choose an interview format.'];
    if (!values.address.trim()) errors.address = ['Enter the workplace address.'];
    if (!values.closes_at) errors.closes_at = ['Choose the date applications close.'];
    else if (values.closes_at < todayInManila()) errors.closes_at = ['The closing date cannot be in the past.'];
  }
  return errors;
}

/** Create (/employer/jobs/new) or edit (/employer/jobs/:id/edit) a posting. */
export default function PostingFormPage() {
  const { id } = useParams();
  const state = useAsync(
    () =>
      Promise.all([
        getCategories(),
        getAccommodationGroups(),
        id ? getJob(id) : Promise.resolve(null),
        // No company yet → 404; the form then shows the "company profile is missing" message on save.
        getCompany().catch(() => null),
      ]),
    [id],
  );

  return (
    <AsyncContent state={state} label="Loading the posting form">
      {([categories, groups, job, company]) => <PostingForm categories={categories} groups={groups} job={job} verified={Boolean(company?.verified_at)} />}
    </AsyncContent>
  );
}

function PostingForm({ categories, groups, job, verified }) {
  const navigate = useNavigate();
  const isEdit = Boolean(job);
  const [step, setStep] = useState(0);
  const stepRef = useRef(null);
  const moved = useRef(false);
  const form = useApiForm({
    title: job?.title ?? '',
    description: job?.description ?? '',
    category_id: job?.category?.id ? String(job.category.id) : '',
    address: job?.address ?? '',
    location_psgc: job?.location?.psgc_code ?? null,
    location_label: job?.location?.label ?? null,
    employment_type: job?.employment_type ?? '',
    work_setup: job?.work_setup ?? '',
    interview_format: job?.interview_format ?? '',
    closes_at: job?.closes_at ?? '',
    accommodationIds: (job?.accommodations ?? []).map((item) => item.id),
    notes: Object.fromEntries((job?.accommodations ?? []).map((item) => [item.id, item.note ?? ''])),
  });
  const { fieldErrors, setFieldErrors, values } = form;
  const canDraft = !isEdit || job.status === 'draft';

  // Only this step's messages are shown (`company` is its own message with a link, below).
  const stepErrors = useMemo(() => {
    const errors = Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => key !== 'company' && stepOf(key) === step));
    // Item-level API errors (accommodations.0.note) are shown once, on the accommodations group.
    const itemError = Object.entries(errors).find(([key]) => key.startsWith('accommodations.'))?.[1];
    for (const key of Object.keys(errors)) if (key.startsWith('accommodations.')) delete errors[key];
    if (itemError && !errors.accommodations) errors.accommodations = itemError;
    return errors;
  }, [fieldErrors, step]);
  const hasStepErrors = Object.keys(stepErrors).length > 0;

  useEffect(() => {
    if (moved.current && !hasStepErrors) stepRef.current?.focus();
    moved.current = false;
  }, [step, hasStepErrors]);

  function goTo(index) {
    moved.current = true;
    setStep(index);
  }

  function next(event) {
    event.preventDefault();
    const errors = checkStep(step, values);
    const others = Object.fromEntries(Object.entries(fieldErrors).filter(([key]) => stepOf(key) !== step));
    setFieldErrors({ ...others, ...errors });
    if (Object.keys(errors).length === 0) goTo(step + 1);
  }

  async function save(submit) {
    const saved = await form.submit(async (current) => {
      const posting = {
        title: current.title,
        description: current.description,
        category_id: current.category_id ? Number(current.category_id) : null,
        address: current.address,
        location_psgc: current.location_psgc,
        location_label: current.location_label,
        employment_type: current.employment_type,
        work_setup: current.work_setup,
        interview_format: current.interview_format,
        closes_at: current.closes_at,
        accommodations: current.accommodationIds.map((accommodationId) => ({ id: accommodationId, note: current.notes[accommodationId]?.trim() || null })),
        submit,
      };
      try {
        return await (isEdit ? updatePosting(job.id, posting) : createPosting(posting));
      } catch (error) {
        // Go back to the first step with a message (company problems are shown on every step).
        const fields = Object.keys(error?.fieldErrors ?? {}).filter((key) => key !== 'company');
        if (fields.length > 0) {
          const first = Math.min(...fields.map(stepOf));
          if (first !== step) goTo(first);
        }
        throw error;
      }
    });
    if (saved) {
      navigate('/employer/jobs', {
        state: { message: submit ? `“${saved.title}” is published and open to job seekers.` : `“${saved.title}” was saved as a draft.` },
      });
    }
  }

  // A published posting cannot go back to draft (Core refuses it): Cancel instead (Figma 16:6324).
  // Before verification a draft is all a company can save, so that is the main button on Review.
  const draftOnly = !verified && canDraft && step === REVIEW;
  const draftButton = draftOnly ? null : canDraft ? (
    <Button type="button" className="button button--secondary" disabled={form.submitting} onClick={() => save(false)}>
      Save as draft
    </Button>
  ) : (
    <Link to="/employer/jobs" className="button button--secondary">
      Cancel
    </Link>
  );

  return (
    <Page
      title={isEdit ? `Edit “${job.title}”` : 'Post a new job'}
      documentTitle={`${isEdit ? `Edit “${job.title}”` : 'Post a new job'} (step ${step + 1} of ${STEPS.length})`}
      back={isEdit ? { to: '/employer/jobs', label: 'Back to job postings' } : undefined}
      subtitle={
        isEdit ? (
          <p className="posting-status">
            Status: <StatusBadge kind="posting" status={job.status} />
          </p>
        ) : (
          <p className="page__subtitle">{STEPS[step].intro}</p>
        )
      }
    >
      <div className={step === 2 ? 'posting-wizard posting-wizard--wide' : 'posting-wizard'}>
        {job?.rejection_reason && (
          // Only postings reviewed before decision 2026-10-21 can still carry a reason.
          <Alert type="error" title="This posting was not approved">
            <p>Reason: {job.rejection_reason} Edit it and publish it again.</p>
          </Alert>
        )}
        {!verified && (
          <Alert type="info" title="Your company is not verified yet">
            <p>
              You can save this job as a draft. You can publish it once an administrator has verified your company.{' '}
              <Link to="/employer/company">View your company profile</Link>
            </p>
          </Alert>
        )}

        <WizardProgress steps={STEPS} current={step} headingRef={stepRef} />

        {fieldErrors.company && (
          <Alert type="error" live="assertive" title="Your company profile is missing">
            <p>
              {fieldErrors.company[0]} <Link to="/employer/company">Set up your company profile</Link>
            </p>
          </Alert>
        )}
        <ErrorSummary errors={stepErrors} fields={FIELDS} />
        <ApiErrorAlert error={form.formError} title="The posting was not saved" />

        <form
          noValidate
          onSubmit={(event) => {
            if (step < REVIEW) return next(event);
            event.preventDefault();
            save(true);
          }}
        >
          {step === 0 && (
            <>
              <TextField label="Job title" required maxLength={255} error={stepErrors.title} {...form.bind('title')} />
              <SelectField
                label="Category"
                name="category_id"
                required
                placeholder="Choose a category"
                options={categories.map((category) => ({ value: String(category.id), label: category.name }))}
                error={stepErrors.category_id}
                {...form.bind('category_id')}
              />
              <RadioGroup
                legend="Employment type"
                name="employment_type"
                required
                className="radio-group--inline"
                options={toOptions(EMPLOYMENT_TYPES)}
                value={values.employment_type}
                onChange={(value) => form.setValue('employment_type', value)}
                error={stepErrors.employment_type}
              />
              <RadioGroup
                legend="Work setup"
                name="work_setup"
                required
                className="radio-group--inline"
                options={toOptions(WORK_SETUPS)}
                value={values.work_setup}
                onChange={(value) => form.setValue('work_setup', value)}
                error={stepErrors.work_setup}
              />
            </>
          )}

          {step === 1 && (
            <>
              <TextArea label="Job description" voice required hint="Duties, qualifications and working hours." error={stepErrors.description} {...form.bind('description')} />
              <RadioGroup
                legend="Interview format"
                name="interview_format"
                required
                className="radio-group--inline"
                options={toOptions(INTERVIEW_FORMATS)}
                value={values.interview_format}
                onChange={(value) => form.setValue('interview_format', value)}
                error={stepErrors.interview_format}
              />
              <TextField label="Workplace address" required hint="Street and building. Used for the accessibility snapshot." error={stepErrors.address} {...form.bind('address')} />
              <LocationPicker
                legend="City or municipality"
                value={values.location_psgc}
                currentLabel={values.location_label}
                onChange={(code, label) => form.setValues((current) => ({ ...current, location_psgc: code, location_label: label }))}
                error={stepErrors.location_psgc}
              />
              <TextField
                label="Applications close on"
                type="date"
                required
                min={todayInManila()}
                hint="Not before today."
                error={stepErrors.closes_at}
                {...form.bind('closes_at')}
              />
            </>
          )}

          {step === 2 && (
            <>
              <Alert type="warning" title="List only what you really provide">
                <p>Hired employees will rate each one.</p>
              </Alert>
              <AccommodationPicker
                legend="Accommodations you provide"
                hint="Choose every accommodation this job offers and add details where helpful."
                groups={groups}
                selected={values.accommodationIds}
                onChange={(ids) => form.setValue('accommodationIds', ids)}
                withNotes
                notes={values.notes}
                onNoteChange={(accommodationId, note) => form.setValue('notes', { ...values.notes, [accommodationId]: note })}
                error={stepErrors.accommodations}
                columns
              />
            </>
          )}

          {step === REVIEW && <Review values={values} categories={categories} groups={groups} onChange={goTo} />}

          <div className="actions wizard__actions">
            {step > 0 && (
              <button type="button" className="button button--secondary" onClick={() => goTo(step - 1)}>
                Back
              </button>
            )}
            {draftButton}
            {draftOnly ? (
              <Button type="button" className="button" disabled={form.submitting} onClick={() => save(false)}>
                Save as draft
              </Button>
            ) : (
              <Button type="submit" id={step === REVIEW ? 'posting-publish' : undefined} className="button" disabled={form.submitting}>
                {step < REVIEW ? 'Next' : isEdit && job.status !== 'draft' ? 'Publish changes' : 'Publish job'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </Page>
  );
}

/** Step 4: what will be sent, in cards with a Change button back to each step. */
function Review({ values, categories, groups, onChange }) {
  const category = categories.find((item) => String(item.id) === values.category_id)?.name;
  const accommodations = groups.flatMap((group) => group.items).filter((item) => values.accommodationIds.includes(item.id));
  const notes = accommodations.filter((item) => values.notes[item.id]?.trim());

  const changeButton = (index, what) => (
    <button type="button" className="button button--link" onClick={() => onChange(index)}>
      Change <span className="visually-hidden">{what}</span>
    </button>
  );

  return (
    <>
      <section className="card review-card" aria-labelledby="review-basics">
        <div className="review-card__header">
          <h3 id="review-basics">Job basics</h3>
          {changeButton(0, 'job basics')}
        </div>
        <dl className="details-list">
          <dt>Job title</dt>
          <dd>{values.title}</dd>
          <dt>Category</dt>
          <dd>{category}</dd>
          <dt>Employment</dt>
          <dd>{EMPLOYMENT_TYPES[values.employment_type]}</dd>
          <dt>Work setup</dt>
          <dd>{WORK_SETUPS[values.work_setup]}</dd>
        </dl>
      </section>

      <section className="card review-card" aria-labelledby="review-place">
        <div className="review-card__header">
          <h3 id="review-place">Description and place</h3>
          {changeButton(1, 'description and place')}
        </div>
        <dl className="details-list">
          <dt>Description</dt>
          <dd className="prose">{values.description}</dd>
          <dt>Interview</dt>
          <dd>{INTERVIEW_FORMATS[values.interview_format]}</dd>
          <dt>Workplace address</dt>
          <dd>
            {values.address}
            {values.location_label && `, ${values.location_label}`}
          </dd>
          <dt>Applications close on</dt>
          <dd>{formatDate(values.closes_at)}</dd>
        </dl>
      </section>

      <section className="card review-card" aria-labelledby="review-accommodations">
        <div className="review-card__header">
          <h3 id="review-accommodations">Accommodations offered</h3>
          {changeButton(2, 'accommodations')}
        </div>
        {accommodations.length === 0 ? (
          <p>None listed. Jobs that list what they provide are easier to find for people who need it.</p>
        ) : (
          <>
            <ul className="tag-list">
              {accommodations.map((item) => (
                <li key={item.id} className="tag">
                  {item.name}
                </li>
              ))}
            </ul>
            {notes.length > 0 && (
              <ul className="job-notes">
                {notes.map((item) => (
                  <li key={item.id}>
                    {item.name}: {values.notes[item.id].trim()}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <Alert type="info" title="What happens next">
        <p>An administrator checks the job. You get a notification when it is live or if something needs changing.</p>
      </Alert>
    </>
  );
}
