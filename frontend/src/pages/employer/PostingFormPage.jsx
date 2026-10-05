import { Link, useNavigate, useParams } from 'react-router-dom';
import { createPosting, getJob, updatePosting } from '../../api/jobs.js';
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
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { todayInManila } from '../../lib/format.js';
import { EMPLOYMENT_TYPES, INTERVIEW_FORMATS, WORK_SETUPS, toOptions } from '../../lib/labels.js';

const FIELDS = Object.fromEntries(
  ['title', 'description', 'category_id', 'address', 'location_psgc', 'employment_type', 'work_setup', 'interview_format', 'closes_at', 'accommodations'].map(
    (name) => [name, { id: name }],
  ),
);

/** Create (/employer/jobs/new) or edit (/employer/jobs/:id/edit) a posting. */
export default function PostingFormPage() {
  const { id } = useParams();
  const state = useAsync(() => Promise.all([getCategories(), getAccommodationGroups(), id ? getJob(id) : Promise.resolve(null)]), [id]);

  return (
    <AsyncContent state={state} label="Loading the posting form">
      {([categories, groups, job]) => <PostingForm categories={categories} groups={groups} job={job} />}
    </AsyncContent>
  );
}

function PostingForm({ categories, groups, job }) {
  const navigate = useNavigate();
  const isEdit = Boolean(job);
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

  // Item-level API errors (accommodations.0.note) are shown once, on the accommodations group.
  const accommodationsError =
    form.fieldErrors.accommodations ??
    Object.entries(form.fieldErrors).find(([key]) => key.startsWith('accommodations.'))?.[1];
  // `company` is not a field on this form: it is shown as its own message with a link (below).
  const summaryErrors = Object.fromEntries(
    Object.entries(form.fieldErrors).filter(([key]) => !key.startsWith('accommodations.') && key !== 'company'),
  );
  if (accommodationsError) summaryErrors.accommodations = accommodationsError;

  async function save(submit) {
    const saved = await form.submit((values) => {
      const posting = {
        title: values.title,
        description: values.description,
        category_id: values.category_id ? Number(values.category_id) : null,
        address: values.address,
        location_psgc: values.location_psgc,
        location_label: values.location_label,
        employment_type: values.employment_type,
        work_setup: values.work_setup,
        interview_format: values.interview_format,
        closes_at: values.closes_at,
        accommodations: values.accommodationIds.map((accommodationId) => ({ id: accommodationId, note: values.notes[accommodationId]?.trim() || null })),
        submit,
      };
      return isEdit ? updatePosting(job.id, posting) : createPosting(posting);
    });
    if (saved) {
      navigate('/employer/jobs', {
        state: { message: submit ? `“${saved.title}” was sent for approval.` : `“${saved.title}” was saved as a draft.` },
      });
    }
  }

  return (
    <Page title={isEdit ? `Edit “${job.title}”` : 'Post a new job'}>
      {isEdit && (
        <p>
          Status: <StatusBadge kind="posting" status={job.status} />
        </p>
      )}
      {job?.rejection_reason && (
        <Alert type="error" title="This posting was not approved">
          <p>Reason: {job.rejection_reason}</p>
        </Alert>
      )}
      <p>
        An OpenDoor administrator approves every job before it appears in search. List each accommodation you really
        provide – hired employees will rate whether you delivered it.
      </p>

      {form.fieldErrors.company && (
        <Alert type="error" live="assertive" title="Your company profile is missing">
          <p>
            {form.fieldErrors.company[0]} <Link to="/employer/company">Set up your company profile</Link>
          </p>
        </Alert>
      )}
      <ErrorSummary errors={summaryErrors} fields={FIELDS} />
      <ApiErrorAlert error={form.formError} title="The posting was not saved" />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save(true);
        }}
      >
        <TextField label="Job title" required maxLength={255} error={form.fieldErrors.title} {...form.bind('title')} />
        <TextArea label="Job description" required hint="Duties, qualifications and working hours." error={form.fieldErrors.description} {...form.bind('description')} />
        <SelectField
          label="Category"
          name="category_id"
          required
          placeholder="Choose a category"
          options={categories.map((category) => ({ value: String(category.id), label: category.name }))}
          error={form.fieldErrors.category_id}
          {...form.bind('category_id')}
        />
        <SelectField label="Employment type" name="employment_type" required placeholder="Choose a type" options={toOptions(EMPLOYMENT_TYPES)} error={form.fieldErrors.employment_type} {...form.bind('employment_type')} />
        <RadioGroup legend="Work setup" name="work_setup" required options={toOptions(WORK_SETUPS)} value={form.values.work_setup} onChange={(value) => form.setValue('work_setup', value)} error={form.fieldErrors.work_setup} />
        <RadioGroup legend="Interview format" name="interview_format" required options={toOptions(INTERVIEW_FORMATS)} value={form.values.interview_format} onChange={(value) => form.setValue('interview_format', value)} error={form.fieldErrors.interview_format} />
        <TextField label="Workplace address" required hint="Street and building. Used for the accessibility snapshot." error={form.fieldErrors.address} {...form.bind('address')} />
        <LocationPicker
          legend="City or municipality"
          value={form.values.location_psgc}
          currentLabel={job?.location?.label}
          onChange={(code, label) => form.setValues((values) => ({ ...values, location_psgc: code, location_label: label }))}
          error={form.fieldErrors.location_psgc}
        />
        <TextField label="Applications close on" type="date" required min={todayInManila()} error={form.fieldErrors.closes_at} {...form.bind('closes_at')} />

        <AccommodationPicker
          legend="Accommodations you provide"
          hint="Choose every accommodation this job offers and add details where helpful."
          groups={groups}
          selected={form.values.accommodationIds}
          onChange={(ids) => form.setValue('accommodationIds', ids)}
          withNotes
          notes={form.values.notes}
          onNoteChange={(accommodationId, note) => form.setValue('notes', { ...form.values.notes, [accommodationId]: note })}
          error={accommodationsError}
        />

        <div className="actions">
          <Button type="submit" className="button" disabled={form.submitting}>
            Submit for approval
          </Button>
          {(!isEdit || job.status === 'draft') && (
            <Button type="button" className="button button--secondary" disabled={form.submitting} onClick={() => save(false)}>
              Save as draft
            </Button>
          )}
        </div>
      </form>
    </Page>
  );
}
