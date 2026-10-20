import { CheckboxGroup, SelectField, TextField } from './form/fields.jsx';
import SkillsPicker from './form/SkillsPicker.jsx';
import LocationPicker from './LocationPicker.jsx';
import { EDUCATION_LEVELS, EMPLOYMENT_TYPES, WORK_SETUPS, toOptions } from '../lib/labels.js';
import { MAX_CANDIDATE_SKILLS } from '../lib/matchingProfile.js';

/**
 * The profile fields that job matching uses (decision 2026-10-21): where the candidate lives,
 * skills, education, experience and work preferences. Shared by the profile page and the
 * first-time setup. `errors` has list item errors already collapsed (collapseItemErrors).
 */
export default function MatchingFields({ form, errors, skillOptions, currentLocationLabel }) {
  const { values } = form;

  return (
    <>
      <LocationPicker
        legend="Where you live"
        required
        value={values.location_psgc}
        currentLabel={currentLocationLabel}
        onChange={(code, label) => form.setValues((current) => ({ ...current, location_psgc: code, location_label: label }))}
        error={errors.location_psgc}
      />
      <SkillsPicker
        id="skills"
        label="Your skills"
        hint="Add at least 3, for example Data entry or Filipino Sign Language."
        required
        value={values.skills}
        onChange={(skills) => form.setValue('skills', skills)}
        options={skillOptions}
        max={MAX_CANDIDATE_SKILLS}
        error={errors.skills}
      />
      <SelectField
        label="Highest education"
        name="education_level"
        required
        placeholder="Choose your highest education"
        options={toOptions(EDUCATION_LEVELS)}
        error={errors.education_level}
        {...form.bind('education_level')}
      />
      <TextField
        label="Years of work experience"
        name="experience_years"
        type="number"
        inputMode="numeric"
        min={0}
        max={60}
        className="field--short"
        hint="Optional. Count all paid work. Enter 0 if you are looking for your first job."
        error={errors.experience_years}
        {...form.bind('experience_years')}
      />
      <CheckboxGroup
        legend="Work setups you prefer"
        name="preferred_work_setups"
        required
        hint="Choose all that suit you."
        options={toOptions(WORK_SETUPS)}
        value={values.preferred_work_setups}
        onChange={(setups) => form.setValue('preferred_work_setups', setups)}
        error={errors.preferred_work_setups}
      />
      <CheckboxGroup
        legend="Types of work you want"
        name="preferred_employment_types"
        required
        hint="Choose all that suit you."
        options={toOptions(EMPLOYMENT_TYPES)}
        value={values.preferred_employment_types}
        onChange={(types) => form.setValue('preferred_employment_types', types)}
        error={errors.preferred_employment_types}
      />
    </>
  );
}
