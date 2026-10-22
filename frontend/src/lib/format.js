// Dates are shown in Philippine time, as the business rules (feedback window, closing dates) use it.
const TIME_ZONE = 'Asia/Manila';

const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: TIME_ZONE, year: 'numeric', month: 'long', day: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** '2026-10-31' or an ISO timestamp → '31 October 2026'. Date-only strings are not shifted. */
export function formatDate(value) {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+08:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

export function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
}

/** 220 → '220 m away', 1450 → '1.5 km away' (distances as text, never only on a map). */
export function formatDistance(metres) {
  if (metres == null) return '';
  // Math.round avoids toFixed's binary rounding (1450 m → '1.5 km', not '1.4 km').
  return metres < 1000 ? `${Math.round(metres)} m away` : `${Math.round(metres / 100) / 10} km away`;
}

/** A share as a whole percentage: (3, 5) → '60%'; no base → '–'. */
export function percent(part, whole) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–';
}

export function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** Today's date in Manila as 'YYYY-MM-DD' (for date inputs' min and max), optionally days ahead. */
export function todayInManila(daysAhead = 0) {
  return dateInManila(new Date(), daysAhead);
}

/** The Manila calendar day of a timestamp (ISO string or Date) as 'YYYY-MM-DD'; days ahead are added first. */
export function dateInManila(value, daysAhead = 0) {
  const date = new Date(new Date(value).getTime() + daysAhead * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

/** Up to two initials of a company name ("Bayanihan Tech Solutions" → "BT"), for logo stand-ins. */
export function companyInitials(name = '') {
  return name
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
