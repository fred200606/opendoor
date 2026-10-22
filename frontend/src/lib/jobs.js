// Plain-language text for a posting's job details (Decision 2026-10-22e).
import { EDUCATION_LEVELS } from './labels.js';

export const SALARY_PERIODS = { hour: 'an hour', day: 'a day', month: 'a month', year: 'a year' };

/** For the posting form's "Paid per" choice. */
export const SALARY_PERIOD_OPTIONS = { month: 'Month', day: 'Day', hour: 'Hour', year: 'Year' };

const PESOS = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });

/** { min: 18000, max: 22000, period: 'month' } → '₱18,000 to ₱22,000 a month'; null → 'Salary not disclosed'. */
export function salaryText(salary) {
  if (!salary || salary.min === null || salary.min === undefined) return 'Salary not disclosed';
  const amount = salary.max && salary.max !== salary.min ? `${PESOS.format(salary.min)} to ${PESOS.format(salary.max)}` : PESOS.format(salary.min);
  return [amount, SALARY_PERIODS[salary.period]].filter(Boolean).join(' ');
}

/** The city of a posting ("Quezon City, National Capital Region (NCR)" → "Quezon City"), else its address. */
export function cityOf(job) {
  const label = job.location?.label?.split(',')[0]?.trim();
  return label || job.address || null;
}

/** Text with one item per line → the items (empty lines and leading "-", "•" or "*" dropped). */
export function lines(text) {
  return (text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

export function yearsText(years) {
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

/**
 * The key qualifications in one line for a job card: minimum education and experience, else the
 * first line of the employer's own qualifications text; null when the job asks for none of them.
 */
export function qualificationSummary(job) {
  const parts = [
    EDUCATION_LEVELS[job.education_level] && `${EDUCATION_LEVELS[job.education_level]} or higher`,
    job.experience_years ? `at least ${yearsText(job.experience_years)} of experience` : null,
  ].filter(Boolean);
  if (parts.length > 0) {
    const text = parts.join(', ');
    return text[0].toUpperCase() + text.slice(1);
  }
  return lines(job.qualifications)[0] ?? null;
}

/**
 * Up to `count` of the job's skills, a candidate's matched ones first (they are the relevant
 * ones), each with `have` when the match says the candidate has it; plus how many are left.
 */
export function cardSkills(job, count = 3) {
  const matched = new Set(job.match?.skills?.matched ?? []);
  const skills = [...(job.skills ?? [])].sort((a, b) => Number(matched.has(b)) - Number(matched.has(a)));
  return {
    shown: skills.slice(0, count).map((name) => ({ name, have: matched.has(name) })),
    more: Math.max(0, skills.length - count),
  };
}
