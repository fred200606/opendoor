// Text of the UI reference PDF (docs/ui-reference/). Written from the frontend code
// (frontend/src/pages, components) – keep it in step when screens change, then rebuild:
//   node ui-reference/capture.mjs && node ui-reference/build.mjs
// Strings may contain simple inline HTML (<code>, <strong>, <em>).

export const meta = {
  title: 'OpenDoor UI Reference',
  subtitle: 'Features, modules, components and screens for every user role',
  purpose:
    'A backup reference for the team designing the OpenDoor user interface. It shows what the working system does today: every screen of every role, what is on it, what the user can do there, the messages it shows and the API it uses. Screenshots were taken from the running application with the seeded demo data.',
};

export const howToRead = [
  'Every screen has the same blocks: <strong>Route</strong> (address in the app), <strong>Who</strong> (roles that can open it), <strong>Purpose</strong>, <strong>On the screen</strong>, <strong>Actions</strong>, <strong>Messages and states</strong> and <strong>API</strong> (calls made through the gateway, base <code>/api</code>).',
  'Labels in quotes are the exact texts used today. A redesign can change the look, but keep the meaning of the texts, the order of steps and the accessibility behaviour described in sections 10–11 and Appendix D.',
  '<span class="tag tag--new">New</span> marks features added after the first SIA screen list (October 10–12, 2026).',
  'Screenshots are 1,200 px wide (desktop) unless the caption says otherwise. Long pages are cut into parts. The demo people and companies are fictional.',
];

export const roles = [
  {
    name: 'Guest',
    label: 'Not logged in',
    does: 'Browses and searches open jobs, reads job details with the Accessibility Snapshot and public employer pages, logs in or creates an account.',
    nav: 'Find jobs · Log in · Create account',
  },
  {
    name: 'Job seeker',
    label: 'Role <code>candidate</code> – person with a disability looking for work',
    does: 'Saves accommodation needs and profile, finds jobs ranked by the needs they meet, applies, follows applications, saves jobs, reports postings, rates the promised accommodations 30 days after being hired.',
    nav: 'Dashboard · Find jobs · My applications · Saved jobs · Profile and needs · Notifications · Account',
  },
  {
    name: 'Employer',
    label: 'Role <code>employer</code> – company that hires',
    does: 'Creates the company profile (checked against the DTI/SEC registry), posts jobs with structured accommodations, reviews applicants, hires or declines, follows its trust score.',
    nav: 'Dashboard · Job postings · Company profile · Trust score · Notifications · Account',
  },
  {
    name: 'Administrator',
    label: 'Role <code>admin</code> – OpenDoor staff',
    does: 'Verifies employers with the business registry, approves or removes postings, suspends users, handles reports, moderates feedback, maintains categories and accommodation types, sees analytics.',
    nav: 'Dashboard · Employers · Postings · Users · Reports · Feedback · Master data · Account',
  },
];

export const modules = [
  ['M1', 'Authentication and accounts', 'Register (job seeker or employer, with data-privacy consent), log in, log out, change password, forgot password with an emailed reset link <span class="tag tag--new">New</span>, session expiry. Login and reset requests limited to 5 per minute; suspended accounts are refused.', 'All', 'Log in, Forgot password, Reset password, Create account, Account settings'],
  ['M2', 'Job seeker profile and needs', 'Accommodation needs (grouped checklist), headline, skills, experience, home location (PSGC), optional disability type with a separate "show to employers" choice, PDF résumé (5 MB).', 'Job seeker', 'Profile and needs'],
  ['M3', 'Company profile and verification', 'Company details, DTI/SEC registration number, office location, logo. An administrator checks the registration with the SOAP business registry and approves or rejects with a reason.', 'Employer, Admin', 'Company profile, Employers, Employer verification'],
  ['M4', 'Job postings', 'Create, edit, save as draft, submit for approval, close, reopen, delete. Each posting lists accommodations with optional details. Admin approves, rejects with a reason or removes.', 'Employer, Admin', 'Job postings, Post a new job, Edit posting, Admin postings'],
  ['M5', 'Search and matching', 'Keyword, category, "must offer" accommodations, sort (best match, newest, closing soon). "Matches my needs" ranks jobs by how many of the job seeker\'s needs they meet.', 'Guest, Job seeker', 'Find jobs, Job details'],
  ['M6', 'Applications', 'Apply with a cover note and an interview accommodation request; statuses Submitted → Reviewed → Hired / Not selected, or Withdrawn by the job seeker.', 'Job seeker, Employer', 'Job details, My applications, Application details, Applicants, Application review'],
  ['M7', 'Feedback and trust score', '30 days after a hire the employee rates each promised accommodation (delivered, partly, not delivered). The employer\'s trust score is published from 3 responses.', 'Job seeker, Employer, public', 'Rate your accommodations, Trust score, Employer page'],
  ['M8', 'Dashboards', 'Summary numbers per role that link to the matching lists.', 'All signed-in roles', 'Dashboards'],
  ['M9', 'Notifications', 'In-app notices for application changes, admin decisions and the rating reminder, unread count in the header; each notice is also emailed (M13).', 'Job seeker, Employer', 'Notifications'],
  ['M10', 'Moderation', 'Suspend and reactivate users, handle posting reports, hide abusive feedback.', 'Admin (reports filed by job seekers)', 'Users, Reports, Feedback'],
  ['M11', 'Master data', 'Job categories and accommodation types (5 groups). In-use items are retired instead of deleted.', 'Admin', 'Master data'],
  ['M12', 'Saved jobs <span class="tag tag--new">New</span>', 'Bookmark jobs from the job page; list and remove them.', 'Job seeker', 'Job details, Saved jobs'],
  ['M13', 'Accessibility settings <span class="tag tag--new">New</span>', 'Text size, high contrast and reduced motion saved to the account; notices also sent by email, with an on/off switch, and a rating reminder on day 30.', 'All', 'Account settings'],
  ['–', 'Accessibility Snapshot (Insights mashup)', 'On every job page: employer claims, community verification and wheelchair-accessible places within 500 m (OpenStreetMap), official place names (PSGC).', 'Everyone', 'Job details'],
  ['–', 'Read aloud and Voice input <span class="tag tag--new">New</span>', 'Browser text-to-speech on job and application pages; browser speech-to-text on search and long text fields (privacy notice first).', 'Everyone', 'Job details, Application details, forms'],
];

export const whatsNew = [
  ['Oct 10', 'Saved jobs (M12)', '"Save job" toggle on the job page and a Saved jobs page.'],
  ['Oct 10', 'Moderation (M10)', 'Admin Users (suspend/reactivate), Reports (dismiss / take action with a note) and Feedback (hide / show again) screens.'],
  ['Oct 10', 'Dashboards (M8) and notifications (M9)', 'Real numbers on all three dashboards; notices for admin decisions on verification and postings.'],
  ['Oct 10', 'Admin removal of postings', '"Remove" on any posting, with a reason that the employer receives.'],
  ['Oct 10', 'Suspended employers', 'Postings of a suspended employer are hidden from job seekers until the account is reactivated.'],
  ['Oct 11', 'Display settings follow the account (M13)', 'Text size, contrast and motion saved with the account and applied at login on any device.'],
  ['Oct 11', 'Read aloud', '"Read this job aloud" / "Read this application aloud" with pause, resume and stop.'],
  ['Oct 11', 'Voice input', '"Speak" button under the search keyword and long text fields, with a one-time privacy notice.'],
  ['Oct 11', 'WCAG 2.1 AA audit fixes', 'Result counts announced also when zero, scrollable trust-score table, autocomplete on personal fields, unique page titles.'],
  ['Oct 11–12', 'Snapshot reliability', 'Second map server and background retry; the snapshot says when it shows an older saved copy.'],
  ['Oct 13', 'Forgot password (M1)', '"Forgot your password?" on Log in, a page that emails a reset link (the same answer for every email), and a page to choose a new password.'],
  ['Oct 12', 'Email notifications (M13)', 'Every notice is also emailed (on by default); "Email notifications" card in Account settings; rating reminder when the feedback form opens (section 9).'],
];

export const tokens = [
  ['--text', '#1f2328', 'Body text (15.8:1)'],
  ['--text-muted', '#57606a', 'Hints, secondary text (6.4:1)'],
  ['--bg', '#ffffff', 'Page background'],
  ['--surface', '#f6f8fa', 'Cards, filter panel, footer, secondary nav'],
  ['--border', '#6e7781', 'Input borders (4.6:1)'],
  ['--divider', '#d0d7de', 'Decorative lines only'],
  ['--primary', '#0b5cad', 'Links, primary buttons, focus ring (6.6:1)'],
  ['--primary-dark', '#08457f', 'Hover, info badge text'],
  ['--danger', '#b42318', 'Errors, danger buttons, count badge (6.5:1)'],
  ['--danger-bg', '#fef3f2', 'Error alert / danger badge background'],
  ['--success', '#116329', 'Success text and badges (7.4:1)'],
  ['--success-bg', '#effaf3', 'Success alert / badge background'],
  ['warning', '#7a4100', 'Warning text on #fff8e6 (7.7:1)'],
  ['info bg', '#eef5fc', 'Info alert and info badge background'],
];

export const foundations = [
  ['Typography', 'System font stack (<code>system-ui, Segoe UI, Roboto, Arial</code>), base 16 px, line height 1.5, h1 2 rem, paragraphs at most 70 characters wide.'],
  ['Layout', 'Content up to 72 rem (1,152 px) centred. Find jobs uses two columns (18 rem filters + results) from 56 rem (896 px); below that everything stacks. Detail lists turn into one column under 30 rem (480 px).'],
  ['Shape and spacing', 'Corner radius 6 px; spacing unit 1 rem; cards have a 1 px divider border.'],
  ['Buttons', 'Primary (filled blue), secondary (white with blue border), small, link-style and danger (red). Minimum height 44 px (40 px small) for touch. Busy buttons keep focus and say what is happening ("Saving…").'],
  ['Status', 'Always text + icon + colour, never colour alone: badges <code>✓</code> success, <code>✕</code> danger, <code>!</code> warning, <code>•</code> info/neutral, <code>–</code> muted.'],
  ['Display settings', 'Text size 100 / 125 / 150 % (root font size), high contrast (black text and borders, darker blue, 4 px focus ring, thicker link underlines) and reduced motion. Applied as <code>data-text-size</code>, <code>data-contrast</code>, <code>data-motion</code> on <code>&lt;html&gt;</code>; the system "reduce motion" setting is also respected.'],
  ['Responsive', 'Works at 360 px width and at 200 % text without sideways scrolling; only the trust-score table scrolls inside its own labelled box.'],
];

export const components = [
  { name: 'AppLayout', crop: 'header', purpose: 'Page frame: "Skip to main content" link, header with the OpenDoor brand (links to the role\'s dashboard), account navigation (Notifications with unread count, user name and role → Account settings, Log out; guests: Log in, Create account), role navigation tabs, main area, footer with OpenStreetMap and PSGC attribution.', notes: 'Admins have no Notifications link. The active tab is bold with a blue underline.' },
  { name: 'Page', purpose: 'Every screen starts with one h1. Sets the browser tab title ("Find jobs – OpenDoor") and moves focus to the h1 after in-app navigation.', notes: 'Where two pages share a heading, the tab title is made unique.' },
  { name: 'Button', purpose: 'Button that stays focusable while unavailable (<code>aria-disabled</code> instead of <code>disabled</code>) and ignores repeated clicks while a request runs.', notes: 'Variants: primary, secondary, small, link, danger.' },
  { name: 'Alert / ApiErrorAlert', crop: 'alert-success', purpose: 'Message box in four types (info ℹ, success ✓, warning !, error ⚠) with optional title. API errors show a plain-language message and a "Reference: …" request id for support.', notes: 'Results are announced politely; blocking errors assertively.' },
  { name: 'ErrorSummary', crop: 'error-summary', purpose: 'Box "There is a problem" above a form after a failed submit, listing every error as a link to its field. It takes focus.', notes: 'GOV.UK error-summary pattern; each field also shows its own error under the label.' },
  { name: 'Form fields', purpose: 'TextField, TextArea (with "N of M characters used" counter), SelectField, CheckboxField, RadioGroup (fieldset + legend, optional hint per option). Label above, then hint, then error, then the input. Required fields say "(required)" in text.', notes: '<code>voice</code> adds the Speak button (VoiceInput).' },
  { name: 'AccommodationPicker', crop: 'accommodation-group', purpose: 'Grouped checkboxes for the accommodation types (Physical access, Communication, Work arrangement, Assistive technology, Support) with short descriptions and a live "N selected." line. In job postings, each checked item gets an optional "Details for …" input.', notes: 'Used for needs, posting accommodations and the "must offer" search filter.' },
  { name: 'LocationPicker', crop: 'location-picker', purpose: 'Region → Province → City or municipality selects from the official PSGC lists (NCR has no provinces). Shows the saved place with a "Change location" link until the user edits it.', notes: 'Lists come from the Insights Service; a failed list is announced.' },
  { name: 'JobCard', crop: 'job-card', purpose: 'Search result: title link, company + Verified badge, "Full-time · Remote · Quezon City…", match badge, up to 4 accommodation tags (+N more), trust score or "not published yet", "Apply by" date.', notes: 'Also used on Saved jobs (with a Remove button) and the employer page.' },
  { name: 'MatchBadge', crop: 'match-badge', purpose: '"★ Meets all 3 of your needs" (green) or "◐ Meets 1 of your 3 needs" (blue). On job details also lists the needs the posting does not mention.', notes: 'Only for job seekers who saved needs.' },
  { name: 'StatusBadge / VerifiedBadge', crop: 'status-table', purpose: 'Pill-shaped status for applications, postings, registry checks and reports (see Appendix B). "✓ Verified employer" for checked companies.', notes: '' },
  { name: 'StatCards', crop: 'stat-cards', purpose: 'Dashboard numbers as a labelled list of tiles; the label links to the filtered list.', notes: 'Grid of 9 rem+ tiles that wraps on small screens.' },
  { name: 'TrustScoreCard', crop: 'trust-card', purpose: '"79% of promised accommodations were delivered – Based on 3 responses…", or "Not published yet … (1 of 3 so far)". Optional table per accommodation (Delivered / Partly / Not delivered).', notes: 'Compact form inside the job page; full table on the employer and trust-score pages.' },
  { name: 'AccessibilitySnapshot', crop: 'snapshot', purpose: 'Insights mashup on the job page: location, "What the employer says", "What hired employees say", "Accessible places nearby" (transport stops, toilets, parking, other places with distance and wheelchair status), source notes and disclaimer.', notes: 'Loads by itself after the job; failures never block the job page.' },
  { name: 'Dialog / ConfirmDialog / ReasonDialog', crop: 'confirm-dialog', purpose: 'Modal on the native <code>&lt;dialog&gt;</code>: traps focus, Escape closes, focus returns to the button that opened it. ConfirmDialog asks yes/no; ReasonDialog asks for a (required or optional) reason or note.', notes: 'Dangerous actions start with focus on Cancel and use a red confirm button.' },
  { name: 'NotificationsLink', purpose: 'Header link "Notifications" with a red count badge and hidden "unread" text; refreshes on every page change and after marking as read.', notes: '' },
  { name: 'AsyncContent, Loading, EmptyState, ResultCount, Pagination, ActionFeedback', purpose: 'Shared states: "Loading …" status line; error with "Try again"; empty state with a title and next step; announced result count ("4 postings"); "← Previous page · Page 1 of 3 · Next page →" (12 items per page); success/error message after an action.', notes: '' },
  { name: 'ReadAloud <span class="tag tag--new">New</span>', purpose: '"Read this job aloud" button: reads the title and main content with the browser\'s own voice. While reading: "Pause reading" / "Resume reading" and "Stop reading".', notes: 'Hidden when the browser cannot speak. Nothing leaves the device.' },
  { name: 'VoiceInput <span class="tag tag--new">New</span>', purpose: '"Speak" button under a text field; adds what the user says to the field until "Stop listening". First use shows a notice that Chrome/Edge send the audio to their speech service.', notes: 'Hidden where the browser has no speech recognition (e.g. Firefox).' },
];

// --------------------------------------------------------------------- screens by role

export const sections = [
  {
    id: 'public',
    title: 'Public screens (guest)',
    intro: 'Open to everyone. The header shows "Log in" and "Create account"; the only tab is "Find jobs".',
    screens: [
      {
        id: 'home', title: 'Home', shots: [['guest-home']],
        route: '/', who: 'Everyone', purpose: 'Explains OpenDoor in one sentence and sends visitors to the jobs or to registration.',
        parts: ['h1 "Find work that fits how you work"', 'Lead paragraph: matching by workplace accommodations, and hired employees confirm whether they were provided', 'Buttons "Browse jobs" (primary) and "Create an account" (secondary)'],
        actions: ['Browse jobs → Find jobs', 'Create an account → Create account'],
        states: [], api: [],
      },
      {
        id: 'find-jobs', title: 'Find jobs', shots: [['guest-jobs']],
        route: '/jobs (guest), /candidate/jobs (job seeker – see 4.3)', who: 'Everyone',
        purpose: 'Search and filter open, approved jobs.',
        parts: [
          'Filter panel (left on wide screens): Keyword (hint "Job title, description or company name.", with Speak button), Category ("All categories"), Sort by (Best match, Newest, Closing soon), collapsible "Must offer these accommodations" with the grouped checklist; "Clear filters" appears when a filter is set',
          'Results: announced count "3 jobs found", list of job cards, pagination',
        ],
        actions: ['Typing filters after a short pause (300 ms) – no search button', 'Every filter is kept in the address, so a search can be shared or bookmarked', 'Open a job card title → Job details'],
        states: ['"Searching jobs…" on first load', 'Empty: "No jobs match these filters – Try fewer filters or a different keyword."', 'Error: "Jobs could not be loaded" with reference id'],
        api: ['GET /job-postings?q=&category=&accommodations[]=&sort=&page=', 'GET /categories', 'GET /accommodations'],
      },
      {
        id: 'job-details', title: 'Job details', shots: [['guest-job']],
        route: '/jobs/{id}', who: 'Everyone (job seekers see their own version – 4.4)',
        purpose: 'Everything about one job: the offer, the accommodations, the employer\'s trust score and the Accessibility Snapshot.',
        parts: [
          'h1 job title, "Read this job aloud" button',
          'Employer name (link to the employer page) + Verified badge; status badge only when the job is not open',
          'Details list: Category, Employment, Work setup, Interview, Address, Apply by',
          '"About the job" description; "Accommodations offered" grouped, each with the employer\'s note (e.g. "– Ramp at the main entrance…")',
          'Trust score card',
          'Guest card "Interested?" with "Log in to apply" (returns to this job after login) or "create an account"',
          'Workplace Accessibility Snapshot (section below the job; see component AccessibilitySnapshot)',
        ],
        actions: ['Log in to apply', 'Read aloud', 'Open the employer page'],
        states: ['Snapshot loads separately: "Loading the accessibility snapshot…"', 'Snapshot failed: warning "The accessibility snapshot is not available right now. The job details above are complete."', 'Partial data notes, e.g. "Nearby places could not be loaded right now." or "Some map information is from an older saved copy…"', 'Unknown or unpublished job: "This job could not be loaded"'],
        api: ['GET /job-postings/{id}', 'GET /insights/job-postings/{id} (Insights mashup: Core summary + PSGC + Nominatim + Overpass)'],
      },
      {
        id: 'employer-page', title: 'Employer page', shots: [['guest-employer']],
        route: '/employers/{id}', who: 'Everyone',
        purpose: 'Public profile of a company with its trust score and open jobs.',
        parts: ['h1 company name, logo, Verified badge, "industry · location"', 'About the company', 'Trust score card with the per-accommodation table "Each accommodation, as rated by hired employees"', '"Open jobs" as job cards'],
        actions: ['Open a job'],
        states: ['No jobs: "No open jobs right now"', 'Unpublished score: "Not published yet. A score appears after 3 hired employees have rated this employer (2 of 3 so far)."'],
        api: ['GET /employers/{id}', 'GET /employers/{id}/trust-score'],
      },
      {
        id: 'login', title: 'Log in', shots: [['guest-login'], ['guest-login-errors', 'After "Log in" with empty fields: error summary and field errors']],
        route: '/login', who: 'Guests (signed-in users are sent to their dashboard)',
        purpose: 'Sign in with email and password.',
        parts: ['Email address (required), Password (required)', '"Log in" button ("Logging in…" while busy)', 'Link "Forgot your password?" <span class="tag tag--new">New</span>', '"New to OpenDoor? Create an account"'],
        actions: ['Log in → the role\'s dashboard, or back to the page the user was sent from (only inside their own portal)', 'Forgot your password? → 3.6'],
        states: ['"Your session has ended – Please log in again to continue." (expired token)', 'After a password reset: success "Your password is changed – Log in with your new password."', 'Wrong email or password: error under Email', '"Your account is suspended – Please contact the OpenDoor administrator…"', '"Too many login attempts – For your security, please wait one minute and try again." (5 per minute)'],
        api: ['POST /login'],
      },
      {
        id: 'forgot-password', title: 'Forgot password', isNew: true, shots: [['guest-forgot'], ['guest-forgot-sent', 'After "Send reset link": the same answer for every email']],
        route: '/forgot-password', who: 'Guests',
        purpose: 'Ask for a link to choose a new password, without revealing whether an email has an account.',
        parts: ['h1 "Reset your password", short explanation', 'Email address (required)', 'Button "Send reset link" ("Sending…")', '"Remembered it? Back to log in"'],
        actions: ['Send reset link → "Check your email – If an OpenDoor account exists for {email}, we sent it a link to choose a new password. The link works for 60 minutes." with "Back to log in" and "Send another link"', 'The email ("Reset your OpenDoor password", button "Choose a new password") goes only to active accounts and also when notification emails are turned off'],
        states: ['Wrong email format: error summary linked to the field', '"Too many requests – For your security, please wait one minute and try again." (5 per minute)', 'One new link per account per minute; the link works once, for 60 minutes'],
        api: ['POST /forgot-password {email} → always 200 with the same message'],
      },
      {
        id: 'reset-password', title: 'Reset password', isNew: true, shots: [['guest-reset', 'Opened from the emailed link'], ['guest-reset-bad', 'A used or expired link']],
        route: '/reset-password?token=…&email=…', who: 'Guests (opened from the email)',
        purpose: 'Choose a new password with the emailed link.',
        parts: ['h1 "Choose a new password", note that the user will be signed out on all devices', 'Email address (filled in from the link), New password ("At least 8 characters."), Confirm new password', 'Button "Save new password" ("Saving…")'],
        actions: ['Save → back to Log in with "Your password is changed – Log in with your new password."; every device is signed out'],
        states: ['Used, expired or wrong link: "This link cannot be used – This reset link is invalid or has expired. Ask for a new one." with a link "Ask for a new link"', 'Link without a token: "This link is incomplete – Open the link from the email again, or ask for a new link."', 'Weak or mismatched password: error summary linked to the field'],
        api: ['POST /reset-password {token, email, password, password_confirmation}'],
      },
      {
        id: 'register', title: 'Create account', shots: [['guest-register'], ['guest-register-errors', 'After "Create account" with empty fields']],
        route: '/register', who: 'Guests',
        purpose: 'Create a job seeker or employer account with data-privacy consent.',
        parts: [
          'Radio group "What brings you to OpenDoor?": "I am looking for a job" (hint: find postings that offer the accommodations you need) / "I am hiring"',
          'Full name, Email address, Password ("At least 8 characters."), Confirm password',
          '"Your privacy" notice (needs used only for matching, seen by employers only when you apply, disability type optional and never used for matching – Data Privacy Act RA 10173)',
          'Consent checkbox "I agree that OpenDoor may process my personal data as described above."',
          '"Create account" button; "Already have an account? Log in"',
        ],
        actions: ['Create account → job seekers go to Profile and needs, employers to Company profile, each with a "Welcome to OpenDoor" message'],
        states: ['Error summary with links to the fields (e.g. email already used, passwords do not match, consent missing)'],
        api: ['POST /register'],
      },
      {
        id: 'not-found', title: 'Page not found', shots: [['guest-404']],
        route: 'any unknown address', who: 'Everyone', purpose: 'Friendly 404.',
        parts: ['"We could not find that page. It may have moved, or the link may be wrong."', 'Link "Go to the home page"'],
        actions: [], states: [], api: [],
      },
    ],
  },
  {
    id: 'candidate',
    title: 'Job seeker screens',
    intro: 'Demo: Maria Santos (<code>candidate@opendoor.test</code>, needs saved) and Juan Dela Cruz (<code>candidate2@opendoor.test</code>, hired, can rate). Tabs: Dashboard · Find jobs · My applications · Saved jobs · Profile and needs. Header: Notifications (unread count), "Maria Santos (Job seeker)" → Account settings, Log out.',
    screens: [
      {
        id: 'candidate-dashboard', title: 'Dashboard', shots: [['cand-dashboard'], ['cand2-dashboard', 'A hired job seeker: "Ratings to give"']],
        route: '/candidate/dashboard', who: 'Job seeker', purpose: 'Start page after login: where my applications stand and what to do next.',
        parts: [
          'h1 "Welcome, {name}"',
          'Callout "Add your accommodation needs so we can show which jobs offer them." + "Add my needs" (only when no needs are saved)',
          'Tiles "Your applications": Submitted, Reviewed, Hired, Not selected, Withdrawn – each opens My applications filtered by that status',
          '"Jobs for you": "1 open job offers all the accommodations you need. See matching jobs"',
          '"Ratings to give": hired, unrated jobs – "rate the accommodations now" link, or "you can rate from {date}"',
        ],
        actions: ['Jump to filtered applications, matching jobs, profile or the feedback form'],
        states: ['"Loading your summary…"'], api: ['GET /candidate/dashboard'],
      },
      {
        id: 'candidate-profile', title: 'Profile and needs', shots: [['cand-profile']],
        route: '/candidate/profile', who: 'Job seeker', purpose: 'The data used for matching and shown to employers when applying.',
        parts: [
          'Card "Accommodations you need": explanation (matching only; employers see them only when you apply), grouped checklist with descriptions and "3 selected.", button "Save my needs"',
          'Card "About you": Headline (hint "Data encoder with 3 years of experience."), Skills ("Separate skills with commas."), Work experience (with Speak), "Where you live" location picker, fieldset "Disability (optional)" with Disability type and – only when filled – checkbox "Show my disability type to employers I apply to"; button "Save profile"',
          'Card "Résumé": link "View your current résumé (PDF, opens in a new tab)" or "You have not uploaded a résumé yet."; file input "Upload / Replace résumé" ("PDF only, up to 5 MB."); button "Upload"',
        ],
        actions: ['Each card saves on its own and confirms below its button ("Your needs are saved.", "Your profile is saved.", "Your résumé is uploaded.")'],
        states: ['First visit after registering: success "Welcome to OpenDoor – Start by choosing the accommodations you need…"', 'Résumé checks before upload: "Choose a PDF file.", "The file is larger than 5 MB."'],
        api: ['GET, PUT /candidate/profile', 'PUT /candidate/accommodations {accommodation_ids}', 'POST /candidate/resume (multipart)', 'GET /accommodations', 'GET /insights/locations/{regions|provinces|cities}'],
      },
      {
        id: 'candidate-find-jobs', title: 'Find jobs with "Matches my needs"', shots: [['cand-jobs']],
        route: '/candidate/jobs', who: 'Job seeker', purpose: 'The guest search plus ranking by the job seeker\'s needs.',
        parts: ['Everything from 3.2', 'Checkbox "Matches my needs" (on by default; hint "Show jobs that offer the accommodations in your profile first.")', 'Match badge on each card'],
        actions: ['"Best match" sorts by needs met, then newest', 'Untick "Matches my needs" for a plain search'],
        states: ['No needs saved: info "Add the accommodations you need to your profile to see which jobs match them."'],
        api: ['GET /job-postings?…&match=1'],
      },
      {
        id: 'candidate-job', title: 'Job details – apply, save, report', shots: [['cand-job'], ['cand-job-partial', 'A job that meets only part of the needs: the badge lists what is missing'], ['cand-job-report', '"Report this job" dialog']],
        route: '/candidate/jobs/{id}', who: 'Job seeker', purpose: 'Decide, apply, bookmark or report.',
        parts: [
          'Everything from 3.3, plus the detailed match badge: "Not mentioned in this posting: …" and "You can ask the employer about these when you apply."',
          'Card "Apply for this job": Cover note (optional, 2,000 characters, Speak, counter), Interview accommodation request (optional, 1,000 characters; hint names the interview format and examples "sign language interpreter, extra time, captions"), button "Send application"',
          'Already applied: card "Your application" – "You applied on {date}. Status: {badge} View your application"',
          '"Save job" toggle (pressed state "Saved") <span class="tag tag--new">New</span> and link-style "Report this job"',
        ],
        actions: ['Send application → success "Application sent – The employer will review it. You can follow its status in My applications."', 'Save job / Saved (announced: "Saved. Find it under Saved jobs.")', 'Report → dialog "What is wrong with this posting?" (required, 1,000 characters; hint "misleading accommodations, discriminatory wording, or a scam") → "Send report"; the link becomes "Reported – thank you"'],
        states: ['"You have already applied to this job. You can follow it in My applications."', '"This job is no longer accepting applications."', 'Only one open report per job seeker and job'],
        api: ['POST /job-postings/{id}/applications', 'POST, DELETE /candidate/saved-jobs/{id}', 'POST /job-postings/{id}/reports {reason}'],
      },
      {
        id: 'candidate-applications', title: 'My applications', shots: [['cand-applications']],
        route: '/candidate/applications', who: 'Job seeker', purpose: 'All applications with their status.',
        parts: ['"Show" select: All applications or one status', 'Announced count ("2 applications")', 'Table: Job (link) · Employer · Applied · Status badge', 'Pagination'],
        actions: ['Open an application', 'Filter by status (also from the dashboard tiles)'],
        states: ['"You have not applied to any jobs yet" + "Find jobs that match your needs"', '"No applications with this status"'],
        api: ['GET /applications?status=&page='],
      },
      {
        id: 'candidate-application', title: 'Application details', shots: [['cand-application'], ['cand-application-withdraw', 'Confirm dialog for withdrawing (focus starts on Cancel)'], ['cand2-application', 'A hired application: the rating card']],
        route: '/candidate/applications/{id}', who: 'Job seeker (own applications)', purpose: 'Follow one application and act on it.',
        parts: ['h1 job title, "Read this application aloud"', '"View the job · {company}"', 'Status badge', 'Applied, Hired (date), Cover note, Interview request', 'Hired only: card "Rate your accommodations"'],
        actions: [
          '"Withdraw application" (Submitted or Reviewed) → confirm "Withdraw this application? The employer will no longer consider you for this job. You cannot undo this."',
          '"I was hired" (Reviewed) → confirm "30 days after today you will be asked to rate whether the promised accommodations were provided."',
          'Rating card: before day 30 "You can rate the accommodations from {date} (30 days after your hire date)."; from day 30 button "Rate accommodations"; afterwards "You have rated … Thank you – your answers are anonymous."',
        ],
        states: ['"Congratulations! Your hire is recorded." / "Your application was withdrawn."', 'Error "The status was not changed"'],
        api: ['GET /applications/{id}', 'PATCH /applications/{id}/status {withdrawn|hired}'],
      },
      {
        id: 'feedback', title: 'Rate your accommodations', shots: [['cand2-feedback']],
        route: '/candidate/applications/{id}/feedback', who: 'Job seeker who was hired at least 30 days ago',
        purpose: 'Anonymous rating of every accommodation the posting promised at the time of hire – this feeds the employer\'s trust score.',
        parts: ['Explanation (anonymous: the employer sees only the combined score)', 'One required radio group per accommodation: Delivered / Partly delivered / Not delivered', 'Comments (optional, "Do not include names.", 2,000 characters, Speak)', 'Button "Submit ratings"'],
        actions: ['Submit → "Thank you – Your ratings are saved. They help other job seekers know which employers keep their promises."'],
        states: ['Missing rating: error per group "Choose a rating for “…”." and error summary', '"Already rated" (each hire is rated once)', '"Not open yet – You can rate the accommodations from {date}, 30 days after your hire date."', '"Nothing to rate" (the posting listed no accommodations)'],
        api: ['GET /applications/{id}/feedback-form', 'POST /applications/{id}/feedback {items[{accommodation_id, rating}], comments}'],
      },
      {
        id: 'saved-jobs', title: 'Saved jobs', isNew: true, shots: [['cand-saved'], ['cand2-saved-empty', 'Empty state']],
        route: '/candidate/saved-jobs', who: 'Job seeker', purpose: 'Bookmarked jobs, newest saved first.',
        parts: ['Job cards, each with a small "Remove" button', 'Status line after removing: "Removed “Data Encoder” from saved jobs."', 'Pagination (12 per page)'],
        actions: ['Open a job', 'Remove'],
        states: ['Empty: "No saved jobs – Use “Save job” on a job’s page to keep it here. Find jobs"', 'Closed or hidden jobs disappear from the list and come back if they reopen'],
        api: ['GET /candidate/saved-jobs?page=', 'DELETE /candidate/saved-jobs/{id}'],
      },
    ],
  },
  {
    id: 'employer',
    title: 'Employer screens',
    intro: 'Demo: Ana Reyes (<code>employer@opendoor.test</code>, Bayanihan Tech Solutions, verified, trust score 79%) and Ramon Villanueva (<code>employer2@opendoor.test</code>, Kalinga Foods Inc., waiting for verification). Tabs: Dashboard · Job postings · Company profile · Trust score.',
    screens: [
      {
        id: 'employer-dashboard', title: 'Dashboard', shots: [['emp-dashboard'], ['emp2-dashboard', 'An employer whose company is not verified yet']],
        route: '/employer/dashboard', who: 'Employer', purpose: 'Postings, applications and trust score at a glance.',
        parts: [
          'h1 "Welcome, {name}"',
          'Callouts: no company → "Set up your company profile so an administrator can verify your business." + "Set up company"; not verified → "Your business registration is waiting for verification." or "Verification was not approved: {reason}" + "View company profile"',
          'Tiles "Your job postings": Draft, Waiting for approval, Open, Closed (link to the filtered list)',
          'Tiles "Applications received" by status',
          'Trust score card',
        ],
        actions: ['Open filtered postings, company profile'], states: [], api: ['GET /employer/dashboard'],
      },
      {
        id: 'company', title: 'Company profile', shots: [['emp-company'], ['emp2-company', 'Waiting for verification']],
        route: '/employer/company', who: 'Employer', purpose: 'Company details that an administrator checks with the DTI/SEC business registry.',
        parts: [
          'Verification alert: "Verified employer – checked on {date}" / "Verification was not approved – Reason: …" / "Waiting for verification"',
          'Company name (required, "As registered with the DTI or SEC."), radio "Registered with": DTI (sole proprietorship) / SEC (corporation or partnership), Business registration number, Industry, Office address, "City or municipality" location picker, About the company (optional, Speak), current logo + Logo file ("PNG, JPG or WebP, up to 2 MB.")',
          'Button "Save company profile"',
        ],
        actions: ['Save → "Your company profile is saved." and "Next: post a job."', 'Changing a verified registration number warns: "Changing this number removes your Verified badge until it is checked again."', 'Saving after a rejection sends the company back to the admin queue'],
        states: ['New employer: empty form with "Welcome to OpenDoor – … An OpenDoor administrator checks your business registration before your jobs go live."'],
        api: ['GET /employer/company', 'PUT /employer/company (POST + _method=PUT when a logo is sent)'],
      },
      {
        id: 'postings', title: 'Job postings', shots: [['emp-postings'], ['emp-postings-delete', 'Delete confirmation (danger: focus starts on Cancel)']],
        route: '/employer/jobs', who: 'Employer', purpose: 'All own postings and their state.',
        parts: ['Button "Post a new job"', '"Show" select by status, announced count', 'Table: Job (link → edit) · Status badge · Applicants (number links to the applicants) · Closes · Actions', 'Actions: "Close" (open jobs), "Reopen" (closed jobs), "Delete"'],
        actions: ['Close / Reopen → "“…” is closed to new applications." / "is open again."', 'Delete → confirm "The job disappears from search. Applications already received stay available to you and the applicants."'],
        states: ['"You have not posted any jobs yet"', 'Message carried over from the form: "“…” was sent for approval." / "was saved as a draft."'],
        api: ['GET /employer/job-postings?status=&page=', 'PATCH /job-postings/{id}/status {open|closed}', 'DELETE /job-postings/{id}'],
      },
      {
        id: 'posting-form', title: 'Post a new job / Edit posting', shots: [['emp-posting-new', 'Post a new job (empty)'], ['emp-posting-edit', 'Edit an open posting']],
        route: '/employer/jobs/new, /employer/jobs/{id}/edit', who: 'Employer (own postings)',
        purpose: 'Write a job with structured accommodations and send it for approval.',
        parts: [
          'Intro: an administrator approves every job; list only accommodations you really provide – hired employees will rate them',
          'Edit only: "Status: {badge}"; after a rejection: alert "This posting was not approved – Reason: …"',
          'Job title, Job description (Speak; hint "Duties, qualifications and working hours."), Category, Employment type (Full-time, Part-time, Contract, Internship), radio Work setup (On-site, Hybrid, Remote), radio Interview format (Online interview, On-site interview), Workplace address ("Used for the accessibility snapshot."), City or municipality, Applications close on (date, not before today)',
          '"Accommodations you provide": grouped checklist; each checked item gets "Details for “…” (optional)" with placeholder "For example: ramp at the main entrance"',
          'Buttons "Submit for approval" and – for new jobs and drafts – "Save as draft"',
        ],
        actions: ['Submit for approval → status "Waiting for approval"; editing an open job sends it back for approval', 'Save as draft → status "Draft"'],
        states: ['No company yet: "Your company profile is missing" + link "Set up your company profile"', 'Error summary listing every missing field'],
        api: ['POST /job-postings', 'PUT /job-postings/{id}', 'GET /job-postings/{id}', 'GET /categories, /accommodations'],
      },
      {
        id: 'applicants', title: 'Applicants', shots: [['emp-applicants']],
        route: '/employer/jobs/{id}/applicants', who: 'Employer (own postings)', purpose: 'Everyone who applied to one job.',
        parts: ['h1 "Applicants for “{job}”", "Back to job postings"', '"Show" select by status, announced count', 'Table: Applicant (link) · Headline · Applied · Status'],
        actions: ['Open an application'], states: ['"No applicants yet"'], api: ['GET /applications?job_posting_id=&status=&page='],
      },
      {
        id: 'application-review', title: 'Application review', shots: [['emp-application']],
        route: '/employer/applications/{id}', who: 'Employer (applications to own postings)',
        purpose: 'Read one application and decide. Opening a Submitted application marks it Reviewed and tells the job seeker.',
        parts: [
          'h1 applicant name; "Applied for {job} on {date}"; status badge; headline',
          'Warning box "Interview accommodation requested" with the request',
          '"Accommodations this applicant needs": each need marked "✓ offered in your posting" or "! not listed in your posting"',
          'Cover note; "About the applicant": Skills, Work experience, Disability (only when the applicant chose to share it), Résumé link (secure link, new tab)',
        ],
        actions: ['Reviewed only: "Mark as hired" (confirm: final; after 30 days the employee can rate) and "Not selected" (danger confirm: final; the applicant is notified)'],
        states: ['"The applicant is marked as hired." / "…as not selected."'],
        api: ['GET /applications/{id}', 'PATCH /applications/{id}/status {hired|rejected}'],
      },
      {
        id: 'trust-score', title: 'Trust score', shots: [['emp-trust']],
        route: '/employer/trust-score', who: 'Employer', purpose: 'The employer\'s own score: totals and per-accommodation counts, never individual answers.',
        parts: ['Explanation: rated 30 days after a hire; partly delivered counts as half; anonymous; published from 3 responses', 'Trust score card with the full table', 'Tip with a link to the job postings'],
        actions: [], states: ['"Your trust score could not be loaded" (e.g. no company yet)'], api: ['GET /employer/company', 'GET /employers/{id}/trust-score'],
      },
    ],
  },
  {
    id: 'admin',
    title: 'Administrator screens',
    intro: 'Demo: OpenDoor Admin (<code>admin@opendoor.test</code>). Tabs: Dashboard · Employers · Postings · Users · Reports · Feedback · Master data. Administrators receive no notifications, so the header has no Notifications link.',
    screens: [
      {
        id: 'admin-dashboard', title: 'Administration dashboard', shots: [['admin-dashboard']],
        route: '/admin/dashboard', who: 'Administrator', purpose: 'Work queues and platform numbers.',
        parts: ['h1 "Administration"', '"Waiting for you": Employers to verify, Postings to approve, Open reports (links to the queues)', '"Users": Job seekers, Employers, Administrators, Suspended', '"Job postings" and "Applications" by status', '"Verification after hire": Feedback responses, Hidden responses, Employers with a published trust score', 'Link "Manage categories and accommodation types"'],
        actions: ['Open a queue'], states: [], api: ['GET /admin/dashboard'],
      },
      {
        id: 'admin-employers', title: 'Employers', shots: [['admin-employers']],
        route: '/admin/employers', who: 'Administrator', purpose: 'Verification queue and company list.',
        parts: ['Filter bar: "Show" (Waiting for verification – default, Verified, Not approved), "Company or registration number", "Search"', 'Announced count', 'Table: Company (link) · Registration (type + number) · Latest registry check (badge or "Not checked yet") · Account (email)'],
        actions: ['Open an employer'], states: ['"No employers here"'], api: ['GET /admin/employers?status=&q=&page='],
      },
      {
        id: 'admin-employer', title: 'Employer verification', shots: [['admin-employer']],
        route: '/admin/employers/{id}', who: 'Administrator', purpose: 'Check the registration with the (simulated) DTI/SEC SOAP registry, then decide.',
        parts: [
          'h1 company, "Back to employers", status line (Verified badge / "Waiting for verification" / "Not approved: {reason}")',
          'Details: Registered with, Registration number, Industry, Address, Account (name + email), Verified on',
          'Card "Business registry result": Status badge (Active, Expired, Cancelled, Not found, Check failed), Registered name, Name match %, Checked; warning "Check this carefully before approving" when not active or the name matches less than 80%',
          'Buttons "Check with the business registry", "Approve", "Do not approve" (or "Remove verification" when verified); hint "The registry result is advice only. You decide whether to approve."',
        ],
        actions: ['Check → "The registry check is done."', 'Approve → confirm "The employer gets the Verified badge…" (+ "No active registry result is on file." when relevant)', 'Do not approve / Remove verification → reason dialog "Reason shown to the employer" → employer notified'],
        states: ['"The business registry did not respond. You can try again later or decide manually."', '"OpenDoor could not sign in to the business registry…"', '"The registry rejected the registration details…"'],
        api: ['GET /admin/employers/{id}', 'PATCH /admin/employers/{id}/verify {action: check|approve|reject, reason}'],
      },
      {
        id: 'admin-postings', title: 'Job postings (approval)', shots: [['admin-postings'], ['admin-postings-reject', '"Do not approve" reason dialog']],
        route: '/admin/job-postings', who: 'Administrator', purpose: 'Approve new or edited postings; remove any posting.',
        parts: ['"Show" select (default Waiting for approval)', 'Posting cards: title, company + Verified + status badges, "category · type · setup · closes {date}", disclosure "Description and accommodations"', 'Buttons "Approve", "Do not approve" (waiting only) and "Remove" <span class="tag tag--new">New</span>'],
        actions: ['Approve → "“…” is approved and now open."', 'Do not approve → reason (hint: "unclear working hours or a missing accommodation detail") → back to draft, employer notified', 'Remove → reason (hint: "false accommodation claims or a duplicate posting") → posting disappears for everyone, applications kept, employer notified'],
        states: ['"No postings are waiting for approval"'],
        api: ['GET /admin/job-postings?status=&page=', 'PATCH /admin/job-postings/{id}/approve {action, reason}', 'DELETE /admin/job-postings/{id} {reason}'],
      },
      {
        id: 'admin-users', title: 'Users', shots: [['admin-users']],
        route: '/admin/users', who: 'Administrator', purpose: 'Find accounts; suspend or reactivate them.',
        parts: ['Filter bar: Role (All roles, Job seeker, Employer, Administrator), "Name or email", "Search"', 'Table: Name · Email · Role · Status (Active / Suspended badge) · Action ("Suspend" / "Reactivate"; own row says "This is you")'],
        actions: ['Suspend → danger confirm: signed out on every device, cannot log in; for employers "Their job postings are hidden from candidates while the account is suspended. Nothing is deleted."', 'Reactivate → confirm; employer postings are shown again'],
        states: ['"No users found"'], api: ['GET /admin/users?role=&q=&page=', 'PATCH /admin/users/{id}/suspend {suspended}'],
      },
      {
        id: 'admin-reports', title: 'Reports', shots: [['admin-reports']],
        route: '/admin/reports', who: 'Administrator', purpose: 'Postings reported by job seekers.',
        parts: ['"Show" select: Open (default, oldest first), Dismissed, Action taken', 'Report cards: posting title (link), company · "Reported {date}" · status badge, the reason as a quote; resolved cards add "Resolved {date} – note: …"', 'Buttons "Dismiss" and "Take action" on open reports'],
        actions: ['Dismiss / Take action → dialog with an optional "Note" (hint for action: "posting closed, employer contacted") → "The report was dismissed." / "…marked as actioned."'],
        states: ['"No reports here"'], api: ['GET /admin/reports?status=&page=', 'PATCH /admin/reports/{id} {status, note}'],
      },
      {
        id: 'admin-feedback', title: 'Feedback responses', shots: [['admin-feedback']],
        route: '/admin/feedback', who: 'Administrator', purpose: 'Moderate the anonymous ratings behind the trust scores.',
        parts: ['Intro: hide only abusive, off-topic or clearly false responses; the score is recalculated', '"Show": All responses, Counted in the score, Hidden', 'Cards: "{company} – {job}", "Submitted {date}", Hidden badge, rating per accommodation, comment quote, button "Hide response" / "Show again"'],
        actions: ['Hide (danger confirm) / Show again → "The employer’s trust score will be recalculated."'],
        states: ['"No feedback responses here"'], api: ['GET /admin/feedback?hidden=&page=', 'PATCH /admin/feedback/{id}/hide {hidden}'],
      },
      {
        id: 'admin-master', title: 'Master data', shots: [['admin-master']],
        route: '/admin/master-data', who: 'Administrator', purpose: 'Job categories and accommodation types used everywhere in the forms.',
        parts: ['Card "Job categories": list with "Rename" (dialog) and "Delete" per item; form "New category" + "Add category"', 'Card "Accommodation types": table Name (+ description) · Group · Status (In use / Retired) · Actions (Edit, Delete or Restore); button "Add accommodation type" → dialog with Name, Group (5 groups), Description (optional, "One short sentence shown under the checkbox.")'],
        actions: ['Delete a category in use → refused: "Categories used by job postings cannot be deleted. Rename them instead."', 'Delete an accommodation in use → retired instead ("It no longer appears in forms."); Restore makes it available again'],
        states: [], api: ['GET /categories, POST/PUT/DELETE /admin/categories', 'GET/POST /admin/accommodations, PUT/DELETE /admin/accommodations/{id}'],
      },
    ],
  },
  {
    id: 'shared',
    title: 'Screens for every signed-in user',
    intro: 'Reached from the header: the Notifications link (job seekers and employers) and the user name (Account settings).',
    screens: [
      {
        id: 'notifications', title: 'Notifications', shots: [['emp-notifications', 'Employer'], ['cand-notifications', 'Job seeker']],
        route: '/notifications', who: 'Job seeker, Employer', purpose: 'In-app notices, newest first (12 per page).',
        parts: ['Line "2 unread notifications" / "Everything is read." and button "Mark all as read"', 'List: "New" badge on unread items, the message as a link to the related page, date and time; "Mark as read" for notices without a link', 'Header link "Notifications" with a red count badge', 'Each notice is also emailed unless the user turned emails off in Account settings (section 9)'],
        actions: ['Open a notice → its page, and it is marked read', 'Mark all as read → "All notifications are marked as read."'],
        states: ['"No notifications yet – You will be told here when an application or posting changes."'],
        api: ['GET /notifications?page=', 'PATCH /notifications/{id}/read', 'PATCH /notifications/read-all'],
      },
      {
        id: 'account', title: 'Account settings', isNew: true, shots: [['cand-account']],
        route: '/account', who: 'All signed-in users', purpose: 'Display settings and password.',
        parts: [
          'Line "{name} · {email} · {role}"',
          'Card "Display": "Changes apply immediately and are saved to your account…"; radio groups Text size (Standard, Large (125%), Extra large (150%)), Colours (Standard colours, High contrast), Motion (Allow animations, Reduce motion); status "Display settings applied and saved to your account."',
          'Card "Change password": Current password, New password ("At least 8 characters, different from the current one."), Confirm new password, button "Change password"',
          'Card "Email notifications" (job seekers and employers only) <span class="tag tag--new">New</span>: checkbox "Send me an email for each notification" (hint: "The email repeats the notice and links to OpenDoor. It never includes disability or accommodation details."), status line below',
        ],
        actions: ['A display change applies at once on this device and is saved to the account (other devices get it at the next login)', 'The email checkbox saves at once: "Email notifications are on." / "Email notifications are off. You still see every notice under Notifications."', 'Change password → "Your password is changed. You were signed out on your other devices."'],
        states: ['Saving failed: "Display settings applied on this device, but not saved to your account. Change a setting to try again."', 'Email choice not saved: the checkbox goes back and "Your choice was not saved. Please try again."'],
        api: ['PUT /me/display-prefs {text_size, contrast, motion}', 'PUT /me/email-notifications {enabled}', 'PUT /me/password'],
      },
    ],
  },
];

export const gallery = [
  { title: 'Error summary after a failed submit', shots: ['guest-login-errors'], text: 'Focus moves to the summary; each line links to its field; each field repeats its error under the label with ⚠.' },
  { title: 'Confirm dialog (dangerous action)', shots: ['emp-postings-delete'], text: 'Red confirm button, focus starts on Cancel, Escape closes, focus returns to the button that opened it.' },
  { title: 'Reason dialog', shots: ['admin-postings-reject'], text: 'Required reason with an inline error "Enter a reason."; used for rejecting employers and postings, removing postings and resolving reports (optional note).' },
  { title: 'Form in a dialog', shots: ['cand-job-report'], text: 'Report this job: required text area with counter and hint, "Send report" / "Cancel".' },
  { title: 'Voice input privacy notice', shots: ['state-voice-notice'], text: 'Shown once before the first use of "Speak": the browser (Chrome/Edge) sends the recording to Google or Microsoft; OpenDoor receives only the text.' },
  { title: 'High contrast and 150 % text', shots: ['state-high-contrast'], text: 'Account → Display. Black text and borders, darker blue, thicker focus ring and link underlines. Layout reflows; nothing is cut off.' },
];

export const phones = {
  title: 'Phone width (390 px)',
  text: 'Header items wrap, tabs wrap onto two lines, the filter panel sits above the results, tiles form two columns.',
  shots: [['state-phone-jobs', 'Find jobs (guest)'], ['state-phone-job', 'Job details (guest)'], ['state-phone-menu', 'Job seeker dashboard']],
};

export const planned = {
  intro: 'The second half of M13, built on October 12, 2026 (user choice: <strong>on by default</strong>, can be turned off). Every in-app notice is also sent by email to job seekers and employers. Administrators receive no notices and have no switch.',
  items: [
    ['Account settings – "Email notifications" card', 'Checkbox "Send me an email for each notification", saved at once with a status line (see 7.2). Value: <code>email_notifications</code> in <code>GET /me</code> and the login response. Save: <code>PUT /me/email-notifications {"enabled": true|false}</code>.'],
    ['Which emails', 'The same events as the in-app notices (Appendix C): new application (employer), status changed by the other side (job seeker or employer), employer verification decision and posting review or removal (employer, with the admin\'s reason), and the rating reminder (job seeker). Suspended accounts get no email.'],
    ['Email content', 'Subject such as "New application for Data Encoder", "Your job posting Data Encoder was approved" or "Rate the accommodations for Data Encoder"; greeting with the name, the notice text, a button "Open in OpenDoor" to the same page as the in-app link, and a footer explaining how to turn the emails off in Account settings. No disability, accommodation-need or interview-request details.'],
    ['Timing and failures', 'Sent right after the action has answered, so a slow mail server never delays the user. A mail server failure is logged and never undoes the action; the in-app notice is always there.'],
    ['Rating reminder', 'Notice type <code>feedback_reminder</code> (in-app and email) to a hired job seeker on the day the feedback form opens (daily run at 08:00, Philippine time), linking to "Rate your accommodations". Once per hire; missed days are caught up; suspended accounts get it after reactivation.'],
    ['Still to set up', 'The mail provider (SMTP) is chosen at deployment; locally the emails are written to the Core log.'],
  ],
};

export const accessibilityRules = [
  'One h1 per screen; after moving to another screen, focus goes to its h1 and the browser tab title changes ("Saved jobs – OpenDoor").',
  '"Skip to main content" link first in the page; landmarks: header, two navigations ("Account", "Main"), main, footer.',
  'Every input has a visible label; hints and errors sit between the label and the input and are linked to it; required fields say "(required)" in text.',
  'After a failed submit show the error summary at the top and move focus to it.',
  'Status is never shown by colour alone (text + icon + colour). Contrast at least 4.5:1 for text and 3:1 for borders and focus rings.',
  'Buttons stay focusable while busy or unavailable; they say what is happening ("Saving…", "Please wait…").',
  'Dialogs: focus inside, Escape closes, focus returns to the opener; dangerous confirmations start on Cancel.',
  'Announce results and saves without moving focus: result counts ("3 jobs found", also "0"), "Your needs are saved.", "Saved. Find it under Saved jobs."',
  'If the focused element disappears (a deleted row), focus goes back to the page h1 instead of the top of the document.',
  'Touch targets at least 44 px; works at 360 px width, 200 % zoom and with the 125/150 % text setting without sideways scrolling.',
  'Dates in Philippine time, written out ("October 12, 2026"); distances as text ("427 m away"), never only on a map.',
  'Read aloud and Voice input appear only where the browser supports them and never start on their own.',
];

export const vocabulary = [
  ['Application', [['pending', 'Submitted', '• neutral'], ['reviewed', 'Reviewed', '• blue'], ['hired', 'Hired', '✓ green'], ['rejected', 'Not selected', '– grey'], ['withdrawn', 'Withdrawn', '– grey']]],
  ['Job posting', [['draft', 'Draft', '– grey'], ['pending_approval', 'Waiting for approval', '! amber'], ['open', 'Open', '✓ green'], ['closed', 'Closed', '– grey']]],
  ['Registry check', [['ACTIVE', 'Active', '✓ green'], ['EXPIRED', 'Expired', '✕ red'], ['CANCELLED', 'Cancelled', '✕ red'], ['NOT_FOUND', 'Not found', '✕ red'], ['ERROR', 'Check failed', '! amber']]],
  ['Report', [['open', 'Open', '! amber'], ['dismissed', 'Dismissed', '– grey'], ['actioned', 'Action taken', '✓ green']]],
  ['Feedback rating', [['delivered', 'Delivered', ''], ['partial', 'Partly delivered (counts as half)', ''], ['not_delivered', 'Not delivered', '']]],
  ['Employment type', [['full_time', 'Full-time', ''], ['part_time', 'Part-time', ''], ['contract', 'Contract', ''], ['internship', 'Internship', '']]],
  ['Work setup', [['onsite', 'On-site', ''], ['hybrid', 'Hybrid', ''], ['remote', 'Remote', '']]],
  ['Interview format', [['online', 'Online interview', ''], ['onsite', 'On-site interview', '']]],
  ['Accommodation group', [['physical_access', 'Physical access', ''], ['communication', 'Communication', ''], ['work_arrangement', 'Work arrangement', ''], ['assistive_technology', 'Assistive technology', ''], ['support', 'Support', '']]],
  ['Role', [['candidate', 'Job seeker', ''], ['employer', 'Employer', ''], ['admin', 'Administrator', '']]],
];

export const notices = [
  ['Employer', 'A job seeker applies', '"Maria Santos applied for Junior Web Developer."', 'Application review'],
  ['Job seeker', 'Employer opens the application', '"Bayanihan Tech Solutions is reviewing your application for Junior Web Developer."', 'Application details'],
  ['Job seeker', 'Employer marks as hired', '"Congratulations! … marked you as hired for {job}. You can rate the promised accommodations from {date}."', 'Application details'],
  ['Job seeker', 'Employer marks as not selected', '"… decided not to continue with your application for {job}."', 'Application details'],
  ['Employer', 'Job seeker withdraws / confirms hire', '"… withdrew the application for {job}." / "… confirmed being hired for {job}."', 'Application review'],
  ['Employer', 'Admin approves or rejects the company', '"{company} is now verified. Candidates see the Verified badge on your postings." / "{company} was not verified: {reason}. Update your company profile to be checked again."', 'Company profile'],
  ['Employer', 'Admin approves, rejects or removes a posting', '"Your posting {job} was approved and is now open to candidates." / "…was not approved: {reason}. Edit it and submit it again." / "…was removed by an administrator: {reason}."', 'Job page / edit form / Job postings'],
  ['Job seeker', 'Feedback form opens (day 30 after the hire; daily run at 08:00)', '"You can now rate the accommodations {company} promised for {job}. Your answers are anonymous."', 'Rate your accommodations'],
];

export const rules = [
  'Postings appear in search only when <strong>open, approved, not deleted and the employer is not suspended</strong>. Drafts and postings waiting for approval are visible only to their owner and admins.',
  'Applications: Submitted → Reviewed (employer opens it) → Hired or Not selected (employer); the job seeker can withdraw while Submitted or Reviewed and can confirm "I was hired" while Reviewed. One application per job.',
  'Applying closes on the "Apply by" date (Philippine time); a daily job closes expired postings at 00:05.',
  'Feedback opens on calendar day 30 after the hire, once per hire, and rates the accommodations the posting listed at the time of hire. That morning the job seeker gets a reminder (in-app and email).',
  'Trust score = delivered ÷ rated, partly delivered counts as half, shown as a whole percent, published from 3 responses.',
  'Needs are used only for matching; employers see them only for applications to their own jobs. Disability type is optional, never used for matching and shown to employers only if the job seeker allows it.',
  'The business registry result is advice: an administrator always decides. Changing the registration number removes the Verified badge until checked again.',
];

export const routes = [
  ['/', 'Home', 'Everyone'], ['/jobs', 'Find jobs', 'Everyone'], ['/jobs/{id}', 'Job details', 'Everyone'], ['/employers/{id}', 'Employer page', 'Everyone'],
  ['/login', 'Log in', 'Guests'], ['/forgot-password', 'Forgot password', 'Guests'], ['/reset-password', 'Reset password (from the email)', 'Guests'], ['/register', 'Create account', 'Guests'],
  ['/candidate/dashboard', 'Dashboard', 'Job seeker'], ['/candidate/jobs', 'Find jobs (match mode)', 'Job seeker'], ['/candidate/jobs/{id}', 'Job details (apply, save, report)', 'Job seeker'],
  ['/candidate/applications', 'My applications', 'Job seeker'], ['/candidate/applications/{id}', 'Application details', 'Job seeker'], ['/candidate/applications/{id}/feedback', 'Rate your accommodations', 'Job seeker'],
  ['/candidate/saved-jobs', 'Saved jobs', 'Job seeker'], ['/candidate/profile', 'Profile and needs', 'Job seeker'],
  ['/employer/dashboard', 'Dashboard', 'Employer'], ['/employer/company', 'Company profile', 'Employer'], ['/employer/jobs', 'Job postings', 'Employer'],
  ['/employer/jobs/new', 'Post a new job', 'Employer'], ['/employer/jobs/{id}/edit', 'Edit posting', 'Employer'], ['/employer/jobs/{id}/applicants', 'Applicants', 'Employer'],
  ['/employer/applications/{id}', 'Application review', 'Employer'], ['/employer/trust-score', 'Trust score', 'Employer'],
  ['/admin/dashboard', 'Administration', 'Admin'], ['/admin/employers', 'Employers', 'Admin'], ['/admin/employers/{id}', 'Employer verification', 'Admin'],
  ['/admin/job-postings', 'Job postings (approval)', 'Admin'], ['/admin/users', 'Users', 'Admin'], ['/admin/reports', 'Reports', 'Admin'],
  ['/admin/feedback', 'Feedback responses', 'Admin'], ['/admin/master-data', 'Master data', 'Admin'],
  ['/notifications', 'Notifications', 'Job seeker, Employer'], ['/account', 'Account settings', 'All signed-in'], ['*', 'Page not found', 'Everyone'],
];

export const demoAccounts = [
  ['admin@opendoor.test', 'OpenDoor Admin', 'Administrator'],
  ['candidate@opendoor.test', 'Maria Santos', 'Job seeker with 3 saved needs'],
  ['candidate2@opendoor.test', 'Juan Dela Cruz', 'Job seeker, hired, can rate'],
  ['employer@opendoor.test', 'Ana Reyes', 'Bayanihan Tech Solutions – verified, trust score 79%'],
  ['employer2@opendoor.test', 'Ramon Villanueva', 'Kalinga Foods Inc. – waiting for verification'],
];
