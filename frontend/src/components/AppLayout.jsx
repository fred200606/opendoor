import { Outlet } from 'react-router-dom';
import { useFocusRescue } from '../hooks/useFocusRescue.js';
import { FirstSignInTour } from './GetStarted.jsx';
import SiteFooter from './SiteFooter.jsx';
import SiteHeader from './SiteHeader.jsx';
import UtilityBar from './UtilityBar.jsx';

/** Page frame from the Figma design: utility bar, role header, main, footer. */
export default function AppLayout() {
  useFocusRescue('main');

  return (
    <>
      <UtilityBar />
      <SiteHeader />

      <main id="main" tabIndex={-1} className="container">
        <Outlet />
        {/* Onboarding: the welcome tour opens on the first page after the first sign-in. */}
        <FirstSignInTour />
      </main>

      <SiteFooter />
    </>
  );
}
