import { APPLICATION_STATUSES, POSTING_STATUSES, REGISTRY_STATUSES, REPORT_STATUSES } from '../lib/labels.js';

// Status = text + icon + color; color is never the only signal.
const KINDS = {
  application: {
    labels: APPLICATION_STATUSES,
    tone: { pending: 'neutral', reviewed: 'info', hired: 'success', rejected: 'muted', withdrawn: 'muted' },
  },
  posting: {
    labels: POSTING_STATUSES,
    tone: { draft: 'muted', pending_approval: 'warning', open: 'success', closed: 'muted' },
  },
  registry: {
    labels: REGISTRY_STATUSES,
    tone: { ACTIVE: 'success', EXPIRED: 'danger', CANCELLED: 'danger', NOT_FOUND: 'danger', ERROR: 'warning' },
  },
  report: {
    labels: REPORT_STATUSES,
    tone: { open: 'warning', dismissed: 'muted', actioned: 'success' },
  },
};

const ICONS = { success: '✓', danger: '✕', warning: '!', info: '•', neutral: '•', muted: '–' };

export default function StatusBadge({ kind, status }) {
  const config = KINDS[kind];
  const tone = config.tone[status] ?? 'neutral';

  return (
    <span className={`badge badge--${tone}`}>
      <span aria-hidden="true">{ICONS[tone]} </span>
      {config.labels[status] ?? status}
    </span>
  );
}

export function VerifiedBadge({ verified }) {
  if (!verified) return null;
  return (
    <span className="badge badge--success" title="Business registration checked by OpenDoor">
      <span aria-hidden="true">✓ </span>Verified employer
    </span>
  );
}
