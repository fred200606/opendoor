import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getSkills } from '../../api/masterData.js';
import { getCandidateProfile, updateCandidateProfile } from '../../api/profile.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import Button from '../../components/Button.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import MatchingFields from '../../components/MatchingFields.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { MATCHING_FIELD_IDS, matchingPayload, matchingValues } from '../../lib/matchingProfile.js';
import { collapseItemErrors } from '../../lib/skills.js';

const MIN_SKILLS = 3;

/** The same rules as Core's CandidateProfile::missingForMatching, so the candidate learns everything at once. */
function checkRequired(values) {
  const errors = {};
  if (!values.location_psgc) errors.location_psgc = ['Choose the city or municipality where you live.'];
  if (values.skills.length < MIN_SKILLS) errors.skills = [`Add at least ${MIN_SKILLS} skills.`];
  if (!values.education_level) errors.education_level = ['Choose your highest education.'];
  if (values.preferred_work_setups.length === 0) errors.preferred_work_setups = ['Choose at least one work setup.'];
  if (values.preferred_employment_types.length === 0) errors.preferred_employment_types = ['Choose at least one type of work.'];
  return errors;
}

/**
 * First-time setup for job seekers (decision 2026-10-21): sign up → this page → dashboard. Other
 * candidate pages send an incomplete profile here (RequireCompleteProfile). These are the fields
 * that job matching uses; needs, a résumé and the rest of the profile come later.
 */
export default function CandidateSetupPage() {
  const { user } = useAuth();
  const [completeOnOpen] = useState(user?.profile_complete === true);
  const state = useAsync(
    () =>
      Promise.all([
        // A brand-new candidate has no profile yet.
        getCandidateProfile().catch((error) => (error.status === 404 ? {} : Promise.reject(error))),
        getSkills(),
      ]),
    [],
  );

  // Only a profile that was complete when the page opened: saving navigates on its own (with a message).
  if (completeOnOpen) return <Navigate to="/candidate/dashboard" replace />;

  return (
    <Page
      title="Complete your profile"
      subtitle={<p className="page__subtitle">We use these answers to recommend jobs that fit your skills, place and preferences.</p>}
    >
      <AsyncContent state={state} label="Loading your profile">
        {([profile, skills]) => <SetupForm profile={profile} skillOptions={skills} />}
      </AsyncContent>
    </Page>
  );
}

function SetupForm({ profile, skillOptions }) {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { updateUser } = useAuth();
  const form = useApiForm(matchingValues(profile));
  const errors = collapseItemErrors(form.fieldErrors, ['skills', 'preferred_work_setups', 'preferred_employment_types']);

  async function handleSubmit(event) {
    event.preventDefault();
    const missing = checkRequired(form.values);
    if (Object.keys(missing).length > 0) {
      form.setFieldErrors(missing);
      return;
    }
    const saved = await form.submit((values) => updateCandidateProfile(matchingPayload(values)));
    if (saved?.profile_complete) {
      updateUser({ profile_complete: true });
      const from = typeof state?.from?.pathname === 'string' && state.from.pathname.startsWith('/candidate/') ? state.from.pathname : '/candidate/dashboard';
      navigate(from, { replace: true, state: { message: 'Your profile is complete. Here are the jobs we recommend for you.' } });
    } else if (saved) {
      form.setFieldErrors(Object.fromEntries((saved.profile_missing ?? []).map((field) => [field, ['This is still missing.']])));
    }
  }

  return (
    <section className="card card--form" aria-labelledby="setup-title">
      <h2 id="setup-title" className="visually-hidden">
        Your profile
      </h2>
      <Alert type="info" title="Required before you continue">
        <p>Everything marked “(required)” is needed to recommend jobs. Your accommodation needs, a résumé and a disability (if you want to share it) can be added afterwards under Profile and needs.</p>
      </Alert>
      <ErrorSummary errors={errors} fields={MATCHING_FIELD_IDS} />
      <ApiErrorAlert error={form.formError} title="Your profile was not saved" />
      <form onSubmit={handleSubmit} noValidate>
        <MatchingFields form={form} errors={errors} skillOptions={skillOptions} currentLocationLabel={profile.location?.label} />
        <Button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save and continue'}
        </Button>
      </form>
    </section>
  );
}
