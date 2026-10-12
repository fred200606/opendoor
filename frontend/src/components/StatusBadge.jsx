import { Check, Circle, Minus, TriangleAlert, X } from 'lucide-react';
import { APPLICATION_STATUSES, POSTING_STATUSES, REGISTRY_STATUSES, REPORT_STATUSES } from '../lib/labels.js';

// Status = text + icon + colour; colour is never the only signal (Figma "Status badge" tones).
const KINDS = {
  application: {
    labels: APPLICATION_STATUSES,
    tone: { pending: 'neutral', reviewed: 'info', hired: 'success', rejected: 'neutral', withdrawn: 'neutral' },
  },
  posting: {
    labels: POSTING_STATUSES,
    tone: { draft: 'neutral', pending_approval: 'warning', open: 'success', closed: 'neutral' },
  },
  registry: {
    labels: REGISTRY_STATUSES,
    tone: { ACTIVE: 'success', EXPIRED: 'danger', CANCELLED: 'danger', NOT_FOUND: 'danger', ERROR: 'warning' },
  },
  report: {
    labels: REPORT_STATUSES,
    tone: { open: 'warning', dismissed: 'neutral', actioned: 'success' },
  },
};

const ICONS = { success: Check, danger: X, warning: TriangleAlert, info: Circle, neutral: Minus };

/** Icon for a badge tone (decorative: the word carries the meaning). */
export function BadgeIcon({ tone }) {
  const Icon = ICONS[tone] ?? Minus;
  return <Icon aria-hidden="true" focusable="false" strokeWidth={2.5} />;
}

export default function StatusBadge({ kind, status }) {
  const config = KINDS[kind];
  const tone = config.tone[status] ?? 'neutral';

  return (
    <span className={`badge badge--${tone}`}>
      <BadgeIcon tone={tone} />
      {config.labels[status] ?? status}
    </span>
  );
}

export function VerifiedBadge({ verified }) {
  if (!verified) return null;
  return (
    <span className="badge badge--success" title="Business registration checked by OpenDoor">
      <BadgeIcon tone="success" />
      Verified employer
    </span>
  );
}
