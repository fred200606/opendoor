import { Link } from 'react-router-dom';
import Page from '../../components/Page.jsx';

/** Footer page (Figma footer link). Describes what the running system does with personal data. */
export default function PrivacyPage() {
  return (
    <Page title="Privacy" className="page--reading">
      <p className="lead">
        OpenDoor follows the Data Privacy Act of 2012 (RA 10173). This page explains what we keep, who can see it and the
        choices you have.
      </p>

      <h2>What we keep</h2>
      <ul>
        <li>Your account: name, email address, password (stored scrambled, never readable) and your role.</li>
        <li>
          Job seekers: the workplace accommodations you need, your headline, skills, work experience, city or municipality,
          an optional disability type and an optional résumé (PDF).
        </li>
        <li>Employers: company details, the business registration number, office address, an optional logo and job postings.</li>
        <li>Applications, the in-app notices about them, and – after an employer contacts you – your ratings of the promised accommodations.</li>
        <li>Your display settings (text size, contrast, motion) and your choice about notification emails.</li>
      </ul>

      <h2>Who can see it</h2>
      <ul>
        <li>
          <strong>Your accommodation needs</strong> are used to match you with jobs. An employer sees them only when you apply
          to one of their jobs.
        </li>
        <li>
          <strong>Your disability type</strong> is optional and never used for matching. Employers see it only if you choose
          to show it.
        </li>
        <li>
          <strong>Your résumé</strong> is seen only by employers you apply to, through a link that works for a short time.
        </li>
        <li>
          <strong>Ratings are anonymous.</strong> Employers and other users see only the combined trust score, never your name
          or your answers.
        </li>
        <li>OpenDoor administrators can see accounts, companies, postings and reports to keep the platform safe.</li>
      </ul>

      <h2>Emails</h2>
      <p>
        We email you a copy of your notifications (application updates, admin decisions, the rating reminder). You can turn
        these emails off in <Link to="/account">Account settings</Link>. Password reset emails are always sent when you ask
        for one. Emails never include disability or accommodation details.
      </p>

      <h2>Maps and voice</h2>
      <ul>
        <li>
          The Accessibility Snapshot on job pages looks up the <em>workplace</em> address with OpenStreetMap services, never
          your address.
        </li>
        <li>Read aloud uses your browser's own voice; nothing is sent to us.</li>
        <li>
          Voice input uses your browser's speech service: Chrome and Edge send the recording to Google or Microsoft. OpenDoor
          receives only the text, and only when you send the form. We ask you before the first use.
        </li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can see and change your profile, needs, résumé and company details at any time, and change your password or
        email choice in Account settings. You agreed to this use of your data when you created your account.
      </p>
    </Page>
  );
}
