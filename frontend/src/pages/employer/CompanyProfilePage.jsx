import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getCompany, saveCompany } from '../../api/profile.js';
import Alert, { ApiErrorAlert } from '../../components/Alert.jsx';
import AsyncContent from '../../components/AsyncContent.jsx';
import ErrorSummary from '../../components/form/ErrorSummary.jsx';
import { RadioGroup, TextArea, TextField } from '../../components/form/fields.jsx';
import LocationPicker from '../../components/LocationPicker.jsx';
import Page from '../../components/Page.jsx';
import { useApiForm } from '../../hooks/useApiForm.js';
import { useAsync } from '../../hooks/useAsync.js';
import { formatDate } from '../../lib/format.js';
import { REGISTRY_TYPES, toOptions } from '../../lib/labels.js';

const LOGO_MAX_MB = 2;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const FIELDS = Object.fromEntries(
  ['company_name', 'business_reg_no', 'registry_type', 'industry', 'address', 'location_psgc', 'description', 'logo'].map((name) => [name, { id: name }]),
);

export default function CompanyProfilePage() {
  const location = useLocation();
  // A new employer has no company yet (404) – show an empty form.
  const state = useAsync(() => getCompany().catch((error) => (error.status === 404 ? null : Promise.reject(error))), []);

  return (
    <Page title="Company profile">
      {location.state?.welcome && (
        <Alert type="success" title="Welcome to OpenDoor">
          <p>Tell us about your company. An OpenDoor administrator checks your business registration before your jobs go live.</p>
        </Alert>
      )}
      <AsyncContent state={state} label="Loading your company profile">
        {(company) => <CompanyForm company={company} onSaved={state.setData} />}
      </AsyncContent>
    </Page>
  );
}

function VerificationStatus({ company }) {
  if (!company) return null;
  if (company.verified_at) {
    return (
      <Alert type="success" title="Verified employer">
        <p>Your business registration was checked on {formatDate(company.verified_at)}. Your jobs show the Verified badge.</p>
      </Alert>
    );
  }
  if (company.verification_rejected_reason) {
    return (
      <Alert type="error" title="Verification was not approved">
        <p>Reason: {company.verification_rejected_reason}</p>
        <p>Correct your registration details below and save to ask for a new check.</p>
      </Alert>
    );
  }
  return (
    <Alert type="info" title="Waiting for verification">
      <p>An OpenDoor administrator will check your business registration with the DTI/SEC registry.</p>
    </Alert>
  );
}

function CompanyForm({ company, onSaved }) {
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const form = useApiForm({
    company_name: company?.company_name ?? '',
    business_reg_no: company?.business_reg_no ?? '',
    registry_type: company?.registry_type ?? '',
    industry: company?.industry ?? '',
    address: company?.address ?? '',
    location_psgc: company?.location?.psgc_code ?? null,
    description: company?.description ?? '',
    logo: null,
  });

  const regNoChanged = company?.verified_at && form.values.business_reg_no !== company.business_reg_no;

  function chooseLogo(event) {
    const file = event.target.files?.[0] ?? null;
    setLogoError(null);
    if (file && !LOGO_TYPES.includes(file.type)) setLogoError('Choose a PNG, JPG or WebP image.');
    else if (file && file.size > LOGO_MAX_MB * 1024 * 1024) setLogoError(`The image is larger than ${LOGO_MAX_MB} MB.`);
    form.setValue('logo', file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (logoError) return;
    setSaved(false);
    const result = await form.submit((values) => saveCompany({ ...values, description: values.description || null, logo: values.logo ?? undefined }));
    if (result) {
      onSaved(result);
      setSaved(true);
    }
  }

  return (
    <>
      <VerificationStatus company={company} />
      <ErrorSummary errors={{ ...form.fieldErrors, ...(logoError ? { logo: logoError } : {}) }} fields={FIELDS} />
      <ApiErrorAlert error={form.formError} title="Your company profile was not saved" />

      <form onSubmit={handleSubmit} noValidate>
        <TextField label="Company name" required hint="As registered with the DTI or SEC." error={form.fieldErrors.company_name} {...form.bind('company_name')} />
        <RadioGroup
          legend="Registered with"
          name="registry_type"
          required
          options={toOptions(REGISTRY_TYPES)}
          value={form.values.registry_type}
          onChange={(value) => form.setValue('registry_type', value)}
          error={form.fieldErrors.registry_type}
        />
        <TextField
          label="Business registration number"
          required
          hint={regNoChanged ? 'Changing this number removes your Verified badge until it is checked again.' : undefined}
          error={form.fieldErrors.business_reg_no}
          {...form.bind('business_reg_no')}
        />
        <TextField label="Industry" required error={form.fieldErrors.industry} {...form.bind('industry')} />
        <TextField label="Office address" required autoComplete="street-address" error={form.fieldErrors.address} {...form.bind('address')} />
        <LocationPicker
          legend="City or municipality"
          value={form.values.location_psgc}
          currentLabel={company?.location?.label}
          onChange={(code) => form.setValue('location_psgc', code)}
          error={form.fieldErrors.location_psgc}
        />
        <TextArea label="About the company" hint="Optional. Include how you support employees with disabilities." error={form.fieldErrors.description} {...form.bind('description')} />

        {company?.logo_url && <img src={company.logo_url} alt="Current company logo" className="employer-logo" />}
        <TextField label="Logo" name="logo" type="file" accept={LOGO_TYPES.join(',')} hint={`Optional. PNG, JPG or WebP, up to ${LOGO_MAX_MB} MB.`} error={logoError ?? form.fieldErrors.logo} onChange={chooseLogo} />

        <button type="submit" className="button" disabled={form.submitting}>
          {form.submitting ? 'Saving…' : 'Save company profile'}
        </button>
        <p role="status" className="save-status">
          {saved && 'Your company profile is saved.'}
        </p>
      </form>
      {saved && (
        <p>
          Next: <Link to="/employer/jobs/new">post a job</Link>.
        </p>
      )}
    </>
  );
}
