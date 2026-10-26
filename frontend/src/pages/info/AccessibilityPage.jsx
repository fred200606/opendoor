import Page from '../../components/Page.jsx';

/** Footer page (Figma footer link). Facts from docs/accessibility/wcag-audit.md. */
export default function AccessibilityPage() {
  return (
    <Page title="Accessibility statement" className="page--reading">
      <p className="lead">
        OpenDoor is built for persons with disabilities, so we aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1
        at level AA on every page.
      </p>

      <h2>Ways to adjust OpenDoor</h2>
      <p>The bar at the top of every page has these shortcuts. Signed-in users find them again in Account settings.</p>
      <ul>
        <li>
          <strong>Text size</strong> – standard, 125 % or 150 %.
        </li>
        <li>
          <strong>High contrast</strong> – darker text, borders and buttons.
        </li>
        <li>
          <strong>Quiet mode</strong> – calmer colours, no decorations or animations.
        </li>
        <li>
          <strong>Compact menu</strong> – only the logo and a Menu button at the top.
        </li>
      </ul>
      <p>
        Job and application pages can be <strong>read aloud</strong> by your browser, and long text fields accept{' '}
        <strong>voice input</strong> in browsers that support it. Everything works with a keyboard and with screen readers,
        and at 200 % zoom without sideways scrolling. Your device's "reduce motion" setting is respected.
      </p>

      <h2>How we check</h2>
      <ul>
        <li>Automated checks (axe) of 34 pages for job seekers, employers, administrators and guests run on every change.</li>
        <li>Scripted checks for keyboard focus, page titles, announcements, text spacing and zoom.</li>
        <li>A review of the code for forms, dialogs, tables and status messages.</li>
      </ul>
    </Page>
  );
}
