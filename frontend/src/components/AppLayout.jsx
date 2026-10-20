import { Outlet } from 'react-router-dom';
import { useFocusRescue } from '../hooks/useFocusRescue.js';
import { FirstSignInTour } from './GetStarted.jsx';
import SiteFooter from './SiteFooter.jsx';
import SiteHeader from './SiteHeader.jsx';
import UtilityBar from './UtilityBar.jsx';

/** Page frame in the IPT look (decision 2026-10-21b): display bar, header, main on the canvas, footer. */
export default function AppLayout() {
  useFocusRescue('main');

  return (
    <div className="flex min-h-screen flex-col">
      <UtilityBar />
      <SiteHeader />

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6">
        <Outlet />
        {/* Onboarding: the welcome tour opens on the first page after the first sign-in. */}
        <FirstSignInTour />
      </main>

      <SiteFooter />
    </div>
  );
}
