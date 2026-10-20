import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { getAccommodationGroups, getSkills } from '../../api/masterData.js';
import { getCandidateProfile, updateCandidateProfile, updateNeeds, uploadResume } from '../../api/profile.js';
import AccommodationPicker from '../../components/AccommodationPicker.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { CheckboxField, TextArea, TextField } from '../../components/form/fields.jsx';
import MatchingFields from '../../components/MatchingFields.jsx';
import ResumeSkillSuggestions from '../../components/ResumeSkillSuggestions.jsx';
import Page from '../../components/Page.jsx';
import Tabs from '../../components/Tabs.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { MATCHING_FIELD_IDS, MAX_CANDIDATE_SKILLS, matchingPayload, matchingValues } from '../../lib/matchingProfile.js';
import { collapseItemErrors, skillKey } from '../../lib/skills.js';

const RESUME_MAX_MB = 5;

const EMPTY_PROFILE = {
  headline: '',
  skills: [],
  experience: '',
  education_level: null,
  experience_years: null,
  preferred_work_setups: [],
  preferred_employment_types: [],
  location_psgc: null,
  location: null,
  disability_type: null,
  show_disability: false,
  resume_url: null,
  accommodations: [],
};

// Figma 5:1343 / 15:5190 / 15:5450: one tab per part; ?tab= keeps the open tab on reload.
const TABS = [
  { id: 'needs', label: 'Accommodations you need' },
  { id: 'about', label: 'About you' },
  { id: 'resume', label: 'Résumé' },
];

export default function CandidateProfilePage() {
  const location = useLocation();
  const state = useAsync(
    () =>
      Promise.all([
        // A brand-new candidate has no profile yet.
        getCandidateProfile().catch((error) => (error.status === 404 ? EMPTY_PROFILE : Promise.reject(error))),
        getAccommodationGroups(),
        getSkills(),
      ]),
    [],
  );

  return (
    <Page title="Profile and needs" subtitle={<p className="page__subtitle">Used only for matching. Employers see your needs only when you apply.</p>}>
      {location.state?.welcome && (
        <Alert type="success" title="Welcome to OpenDoor">
          <p>Start by choosing the accommodations you need. We use them to show you the jobs that fit best.</p>
        </Alert>
      )}
      <AsyncContent state={state} label="Loading your profile">
        {([profile, groups, skills]) => <ProfileTabs profile={profile} groups={groups} skills={skills} />}
      </AsyncContent>
    </Page>
  );
}

/** The résumé link is shared: an upload makes "Suggest skills from my résumé" appear under About you. */
function ProfileTabs({ profile, groups, skills }) {
  const [params, setParams] = useSearchParams();
  const [resumeUrl, setResumeUrl] = useState(profile.resume_url);

  return (
    <Tabs
      label="Parts of your profile"
      selected={params.get('tab') ?? 'needs'}
      onSelect={(tab) => setParams(tab === 'needs' ? {} : { tab }, { replace: true })}
      tabs={TABS.map((tab) => ({
        ...tab,
        content:
          tab.id === 'needs' ? (
            <NeedsSection profile={profile} groups={groups} />
          ) : tab.id === 'about' ? (
            <ProfileSection profile={profile} skillOptions={skills} hasResume={Boolean(resumeUrl)} />
          ) : (
            <ResumeSection resumeUrl={resumeUrl} onUploaded={setResumeUrl} />
          ),
      }))}
    />
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
    <section className="card card--needs" aria-labelledby="needs-title">
      <h2 id="needs-title" className="visually-hidden">
        Accommodations you need
      </h2>
      <p className="profile-intro">
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
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save my needs'}
        </Button>
        <p role="status" className="save-status">
          {saved && 'Your needs are saved.'}
        </p>
      </form>
    </section>
  );
}

const PROFILE_FIELDS = {
  headline: { id: 'headline' },
  ...MATCHING_FIELD_IDS,
  experience: { id: 'experience' },
  disability_type: { id: 'disability_type' },
};

function ProfileSection({ profile, skillOptions, hasResume }) {
  const [saved, setSaved] = useState(false);
  const form = useApiForm({
    headline: profile.headline ?? '',
    ...matchingValues(profile),
    experience: profile.experience ?? '',
    disability_type: profile.disability_type ?? '',
    show_disability: Boolean(profile.show_disability),
  });
  const errors = collapseItemErrors(form.fieldErrors, ['skills', 'preferred_work_setups', 'preferred_employment_types']);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaved(false);
    const result = await form.submit((values) =>
      updateCandidateProfile({
        headline: values.headline,
        ...matchingPayload(values),
        experience: values.experience,
        disability_type: values.disability_type || null,
        show_disability: values.disability_type ? values.show_disability : false,
      }),
    );
    if (result) setSaved(true);
  }

  return (
    <section className="card card--form" aria-labelledby="profile-title">
      <h2 id="profile-title" className="visually-hidden">
        About you
      </h2>
      <ErrorSummary errors={errors} fields={PROFILE_FIELDS} />
      <ApiErrorAlert error={form.formError} title="Your profile was not saved" />
      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Headline" hint="For example: Data encoder with 3 years of experience." maxLength={255} error={errors.headline} {...form.bind('headline')} />
        <MatchingFields
          form={form}
          errors={errors}
          skillOptions={skillOptions}
          currentLocationLabel={profile.location?.label}
          afterSkills={
            hasResume && (
              <ResumeSkillSuggestions
                onAdd={(found) =>
                  form.setValues((current) => {
                    const have = new Set(current.skills.map(skillKey));
                    const added = found.filter((skill) => !have.has(skillKey(skill)));
                    return { ...current, skills: [...current.skills, ...added].slice(0, MAX_CANDIDATE_SKILLS) };
                  })
                }
              />
            )
          }
        />
        <TextArea label="Work experience" hint="Where you worked and what you did." voice error={errors.experience} {...form.bind('experience')} />

        <fieldset className="fieldset field fieldset--box">
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

        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save profile'}
        </Button>
        <p role="status" className="save-status">
          {saved && 'Your profile is saved.'}
        </p>
      </form>
    </section>
  );
}

function ResumeSection({ resumeUrl, onUploaded }) {
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
      onUploaded(result.resume_url);
      setSaved(true);
    }
  }

  const error = clientError ?? form.fieldErrors.resume;

  return (
    <section className="card card--form" aria-labelledby="resume-title">
      <h2 id="resume-title" className="visually-hidden">
        Résumé
      </h2>
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
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Uploading…' : 'Upload'}
        </Button>
        <p role="status" className="save-status">
          {saved && 'Your résumé is uploaded. Under “About you” you can add skills we find in it.'}
        </p>
      </form>
    </section>
  );
}
