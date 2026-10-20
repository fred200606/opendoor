// The candidate profile fields that job matching uses (decision 2026-10-21); see MatchingFields.jsx.

export const MAX_CANDIDATE_SKILLS = 30;

/** Error-summary links for the fields below (API field name → element id). */
export const MATCHING_FIELD_IDS = {
  location_psgc: { id: 'location_psgc' },
  skills: { id: 'skills' },
  education_level: { id: 'education_level' },
  experience_years: { id: 'experience_years' },
  preferred_work_setups: { id: 'preferred_work_setups' },
  preferred_employment_types: { id: 'preferred_employment_types' },
};

/** The form values for these fields from a CandidateProfile. */
export function matchingValues(profile) {
  return {
    location_psgc: profile.location_psgc ?? null,
    location_label: profile.location?.label ?? null,
    skills: profile.skills ?? [],
    education_level: profile.education_level ?? '',
    experience_years: profile.experience_years ?? '',
    preferred_work_setups: profile.preferred_work_setups ?? [],
    preferred_employment_types: profile.preferred_employment_types ?? [],
  };
}

/** The CandidateProfileInput part for these fields. */
export function matchingPayload(values) {
  return {
    location_psgc: values.location_psgc,
    location_label: values.location_label,
    skills: values.skills,
    education_level: values.education_level || null,
    experience_years: values.experience_years === '' ? null : Number(values.experience_years),
    preferred_work_setups: values.preferred_work_setups,
    preferred_employment_types: values.preferred_employment_types,
  };
}
