// Plain-English labels for the API enums (docs/openapi.yaml → components.schemas).

export const EMPLOYMENT_TYPES = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export const WORK_SETUPS = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };

export const INTERVIEW_FORMATS = { online: 'Online interview', onsite: 'On-site interview' };

export const POSTING_STATUSES = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
};

export const APPLICATION_STATUSES = {
  pending: 'Submitted',
  reviewed: 'Reviewed',
  hired: 'Hired',
  rejected: 'Not selected',
  withdrawn: 'Withdrawn',
};

export const REGISTRY_TYPES = { DTI: 'DTI (sole proprietorship)', SEC: 'SEC (corporation or partnership)' };

export const REGISTRY_STATUSES = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
  NOT_FOUND: 'Not found',
  ERROR: 'Check failed',
};

export const FEEDBACK_RATINGS = {
  delivered: 'Delivered',
  partial: 'Partly delivered',
  not_delivered: 'Not delivered',
};

export const REPORT_STATUSES = { open: 'Open', dismissed: 'Dismissed', actioned: 'Action taken' };

export const ACCOMMODATION_GROUPS = {
  physical_access: 'Physical access',
  communication: 'Communication',
  work_arrangement: 'Work arrangement',
  assistive_technology: 'Assistive technology',
  support: 'Support',
};

export const SORTS = { best: 'Best match', newest: 'Newest', closing: 'Closing soon' };

/** { key: label } → [{ value, label }] for SelectField / RadioGroup. */
export function toOptions(labels) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
