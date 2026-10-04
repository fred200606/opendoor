import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAccommodationGroups } from '../../api/masterData.js';
import { getCandidateProfile, updateCandidateProfile, updateNeeds, uploadResume } from '../../api/profile.js';
import AccommodationPicker from '../../components/AccommodationPicker.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { CheckboxField, TextArea, TextField } from '../../components/form/fields.jsx';
import LocationPicker from '../../components/LocationPicker.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';

const RESUME_MAX_MB = 5;

const EMPTY_PROFILE = {
  headline: '',
  skills: [],
  experience: '',
  location_psgc: null,
  location: null,
  disability_type: null,
  show_disability: false,
  resume_url: null,
  accommodations: [],
};

export default function CandidateProfilePage() {
  const location = useLocation();
  const state = useAsync(
    () =>
      Promise.all([
        // A brand-new candidate has no profile yet.
        getCandidateProfile().catch((error) => (error.status === 404 ? EMPTY_PROFILE : Promise.reject(error))),
        getAccommodationGroups(),
      ]),
    [],
  );

  return (
    <Page title="Profile and needs">
      {location.state?.welcome && (
        <Alert type="success" title="Welcome to OpenDoor">
          <p>Start by choosing the accommodations you need. We use them to show you the jobs that fit best.</p>
        </Alert>
      )}
      <AsyncContent state={state} label="Loading your profile">
        {([profile, groups]) => (
          <>
            <NeedsSection profile={profile} groups={groups} />
            <ProfileSection profile={profile} />
            <ResumeSection profile={profile} />
          </>
        )}
      </AsyncContent>
    </Page>
  );
}

function NeedsSection({ profile, groups }) {
  const [selected, setSelected] = useState(() => (profile.accommodations ?? []).map((item) => item.id));
  const [saved, setSaved] = useState(false);
  const form = useApiForm({});

  async function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    const result = await form.submit(() => updateNeeds(selected));
    if (result) setSaved(true);
  }

  return (
    <section className="card" aria-labelledby="needs-title">
      <h2 id="needs-title">Accommodations you need</h2>
      <p>
        We match jobs on these needs only. Employers see them only when you apply to one of their jobs. You can change
        them at any time.
      </p>
      <ApiErrorAlert error={form.formError} title="Your needs were not saved" />
      <form onSubmit={handleSubmit} noValidate>
        <AccommodationPicker
          id="accommodation_ids"
          legend="Choose all that apply"
          groups={groups}
          selected={selected}
          onChange={(ids) => {
            setSelected(ids);
            setSaved(false);
          }}
          error={form.fieldErrors.accommodation_ids}
        />
        <button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save my needs'}
        </button>
        <p role="status" className="save-status">
          {saved && 'Your needs are saved.'}
        </p>
      </form>
    </section>
  );
}

const PROFILE_FIELDS = {
  headline: { id: 'headline' },
  skills: { id: 'skills' },
  experience: { id: 'experience' },
  location_psgc: { id: 'location_psgc' },
  disability_type: { id: 'disability_type' },
};

function ProfileSection({ profile }) {
  const [saved, setSaved] = useState(false);
  const form = useApiForm({
    headline: profile.headline ?? '',
    skills: (profile.skills ?? []).join(', '),
    experience: profile.experience ?? '',
    location_psgc: profile.location_psgc ?? null,
    disability_type: profile.disability_type ?? '',
    show_disability: Boolean(profile.show_disability),
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    const result = await form.submit((values) =>
      updateCandidateProfile({
        headline: values.headline,
        skills: values.skills
          .split(',')
          .map((skill) => skill.trim())
          .filter(Boolean),
        experience: values.experience,
        location_psgc: values.location_psgc,
        disability_type: values.disability_type || null,
        show_disability: values.disability_type ? values.show_disability : false,
      }),
    );
    if (result) setSaved(true);
  }

  return (
    <section className="card" aria-labelledby="profile-title">
      <h2 id="profile-title">About you</h2>
      <ErrorSummary errors={form.fieldErrors} fields={PROFILE_FIELDS} />
      <ApiErrorAlert error={form.formError} title="Your profile was not saved" />
      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Headline" hint="For example: Data encoder with 3 years of experience." maxLength={255} error={form.fieldErrors.headline} {...form.bind('headline')} />
        <TextField label="Skills" hint="Separate skills with commas." error={form.fieldErrors.skills} {...form.bind('skills')} />
        <TextArea label="Work experience" error={form.fieldErrors.experience} {...form.bind('experience')} />
        <LocationPicker
          legend="Where you live"
          value={form.values.location_psgc}
          currentLabel={profile.location?.label}
          onChange={(code) => form.setValue('location_psgc', code)}
          error={form.fieldErrors.location_psgc}
        />

        <fieldset className="fieldset field">
          <legend className="field__label">Disability (optional)</legend>
          <p className="field__hint">
            You do not have to tell us. It is never used for matching and stays hidden unless you choose to show it to
            employers you apply to.
          </p>
          <TextField label="Disability type" error={form.fieldErrors.disability_type} {...form.bind('disability_type')} />
          {form.values.disability_type && (
            <CheckboxField label="Show my disability type to employers I apply to" {...form.bindCheckbox('show_disability')} />
          )}
        </fieldset>

        <button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save profile'}
        </button>
        <p role="status" className="save-status">
          {saved && 'Your profile is saved.'}
        </p>
      </form>
    </section>
  );
}

function ResumeSection({ profile }) {
  const [resumeUrl, setResumeUrl] = useState(profile.resume_url);
  const [file, setFile] = useState(null);
  const [clientError, setClientError] = useState(null);
  const [saved, setSaved] = useState(false);
  const form = useApiForm({});

  function choose(event) {
    const chosen = event.target.files?.[0] ?? null;
    setSaved(false);
    setClientError(null);
    if (chosen && chosen.type !== 'application/pdf') setClientError('Choose a PDF file.');
    else if (chosen && chosen.size > RESUME_MAX_MB * 1024 * 1024) setClientError(`The file is larger than ${RESUME_MAX_MB} MB.`);
    setFile(chosen);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setClientError('Choose a PDF file to upload.');
      return;
    }
    if (clientError) return;
    const result = await form.submit(() => uploadResume(file));
    if (result) {
      setResumeUrl(result.resume_url);
      setSaved(true);
    }
  }

  const error = clientError ?? form.fieldErrors.resume;

  return (
    <section className="card" aria-labelledby="resume-title">
      <h2 id="resume-title">Résumé</h2>
      {resumeUrl ? (
        <p>
          <a href={resumeUrl} target="_blank" rel="noreferrer">
            View your current résumé (PDF, opens in a new tab)
          </a>
        </p>
      ) : (
        <p>You have not uploaded a résumé yet.</p>
      )}
      <ApiErrorAlert error={form.formError} title="Your résumé was not uploaded" />
      <form onSubmit={handleSubmit} noValidate>
        <TextField
          label={resumeUrl ? 'Replace résumé' : 'Upload résumé'}
          name="resume"
          type="file"
          accept="application/pdf"
          hint={`PDF only, up to ${RESUME_MAX_MB} MB.`}
          error={error}
          onChange={choose}
        />
        <button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Uploading…' : 'Upload'}
        </button>
        <p role="status" className="save-status">
          {saved && 'Your résumé is uploaded.'}
        </p>
      </form>
    </section>
  );
}
