import { Briefcase, Check, FileText, Minus, Search, Star, X } from 'lucide-react';

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
  contacted: { icon: Check, tone: 'sky' },
  rejected: { icon: X, tone: 'pink' },
  withdrawn: { icon: Minus, tone: 'pink' },
};
