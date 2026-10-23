import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useFocusRescue } from '../hooks/useFocusRescue.js';
import Loading from './Loading.jsx';
import SiteFooter from './SiteFooter.jsx';
import SiteHeader from './SiteHeader.jsx';
import TourProvider from './tour/TourProvider.jsx';
import UtilityBar from './UtilityBar.jsx';

/** Page frame in the IPT look (decision 2026-10-21b): display bar, header, main on the canvas, footer. */
export default function AppLayout() {
  useFocusRescue('main');

  return (
    // Onboarding: the welcome tour starts on the dashboard after the first sign-in (TourProvider).
    <TourProvider>
      <div className="flex min-h-screen flex-col">
        <UtilityBar />
        <SiteHeader />

        <main id="main" tabIndex={-1} data-tour="page" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6">
          <Suspense fallback={<Loading label="Loading the page" />}>
            <Outlet />
          </Suspense>
        </main>

        <SiteFooter />
      </div>
    </TourProvider>
  );
}
