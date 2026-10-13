// Top menu per role (Figma "Header": links on both sides of the centred logo). Labels follow the
// design; icons are used in the compact menu. Account and Log out are added by the header itself.
import {
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  ClipboardCheck,
  Database,
  FileText,
  Flag,
  House,
  MessageSquare,
  Search,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';

export const NAVIGATION = {
  guest: {
    left: [
      { to: '/', label: 'Home', icon: House, end: true },
      { to: '/jobs', label: 'Find jobs', icon: Search },
    ],
    right: [],
  },
  candidate: {
    left: [
      { to: '/candidate/dashboard', label: 'Dashboard', icon: House },
      { to: '/candidate/jobs', label: 'Find jobs', icon: Search },
      { to: '/candidate/applications', label: 'Applications', icon: FileText },
      { to: '/candidate/saved-jobs', label: 'Saved jobs', icon: Bookmark },
    ],
    right: [{ to: '/candidate/profile', label: 'Profile', icon: User }],
  },
  employer: {
    left: [
      { to: '/employer/dashboard', label: 'Dashboard', icon: House },
      { to: '/employer/jobs', label: 'Job postings', icon: Briefcase },
      { to: '/employer/company', label: 'Company', icon: Building2 },
      { to: '/employer/trust-score', label: 'Trust score', icon: ShieldCheck },
    ],
    right: [],
  },
  admin: {
    left: [
      { to: '/admin/dashboard', label: 'Dashboard', icon: House },
      { to: '/admin/employers', label: 'Employers', icon: Building2 },
      { to: '/admin/job-postings', label: 'Postings', icon: ClipboardCheck },
      { to: '/admin/users', label: 'Users', icon: Users },
    ],
    right: [
      { to: '/admin/reports', label: 'Reports', icon: Flag },
      { to: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
      { to: '/admin/master-data', label: 'Data', icon: Database },
    ],
  },
};

export const NOTIFICATIONS_ICON = Bell;

/** Where job links point for this viewer (candidates stay inside their portal). */
export function jobPath(role, id) {
  return role === 'candidate' ? `/candidate/jobs/${id}` : `/jobs/${id}`;
}
