import { BadgeCheck, Briefcase, FileText, Hourglass, Minus, Phone, Search, Star, X } from 'lucide-react';

// Figma "Stat tile": the icon and colour of each status, the same on every dashboard.

export const POSTING_TILES = {
  draft: { icon: FileText, tone: 'lilac' },
  open: { icon: Briefcase, tone: 'sky' },
  closed: { icon: X, tone: 'pink' },
};

export const APPLICATION_TILES = {
  pending: { icon: FileText, tone: 'pink' },
  reviewed: { icon: Search, tone: 'lilac' },
  shortlisted: { icon: Star, tone: 'orange' },
  contacted: { icon: Phone, tone: 'lilac' },
  hired: { icon: BadgeCheck, tone: 'sky' },
  rejected: { icon: X, tone: 'pink' },
  withdrawn: { icon: Minus, tone: 'pink' },
};

/**
 * The stage tiles of the candidate and employer dashboards, from `pipeline` (Decision 2026-10-22b).
 * A job-closed application counts as closed; "hiring to confirm" overlaps the stages.
 * The first tile differs per role: for the candidate a new application already waits on the
 * employer's review; the employer sees new and opened ones together.
 */
export function pipelineTiles(pipeline = {}, role = 'candidate') {
  const value = (key) => pipeline[key] ?? 0;
  return [
    { label: role === 'employer' ? 'New or under review' : 'Under review', value: value('submitted') + value('under_review'), icon: Search, tone: 'lilac' },
    { label: 'Shortlisted', value: value('shortlisted'), icon: Star, tone: 'orange' },
    { label: 'Contacted', value: value('contacted'), icon: Phone, tone: 'lilac' },
    { label: 'Hiring confirmations pending', value: value('hiring_pending'), icon: Hourglass, tone: 'orange' },
    { label: 'Confirmed hires', value: value('hired'), icon: BadgeCheck, tone: 'sky' },
    { label: 'Closed', value: value('closed'), icon: Minus, tone: 'pink' },
  ];
}
