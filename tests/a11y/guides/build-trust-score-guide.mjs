// Builds docs/guides/OpenDoor-Trust-Score-Guide.pdf from the capture of capture-trust-score.mjs
// (tests/a11y/results/guides/trust-score/). Dates and numbers in the text come from that capture,
// so they always match the screenshots. Run: node guides/build-trust-score-guide.mjs

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { esc, list, printPdf } from './guide-common.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const CAPTURE = join(HERE, '..', 'results', 'guides', 'trust-score');
const PDF = join(REPO, 'docs', 'guides', 'OpenDoor-Trust-Score-Guide.pdf');

const F = JSON.parse(readFileSync(join(CAPTURE, 'trust-score.json'), 'utf8'));
const commit = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const long = (iso) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'long' }).format(new Date(iso));
/** A plain date (YYYY-MM-DD) as "October 30, 2026" – no time zone shift. */
const day = (date) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(`${date}T00:00:00Z`));
const shortDay = (date) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${date}T00:00:00Z`));
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
const generated = long(new Date().toISOString());
const captured = long(F.captured_at);
const appliedOn = F.hired_at.slice(0, 10);

function figure(file, caption, { width } = {}) {
  const src = pathToFileURL(join(CAPTURE, 'shots', file)).href;
  return `<figure class="shot"><img src="${src}" alt="${esc(caption)}"${width ? ` style="width:${width}"` : ''}><figcaption>${caption}</figcaption></figure>`;
}

/** One numbered step: who does it, what they do, what the system does, and the screenshots. */
function step(no, role, title, { does, system, shots = [], note }) {
  return `<section class="tstep" id="step-${no}">
  <h3><span class="no">${no}</span>${title}<span class="role">${role}</span></h3>
  ${does ? `<p>${does}</p>` : ''}
  ${system ? `<p class="behind"><b>Behind the screen:</b> ${system}</p>` : ''}
  ${note ? `<p class="callout">${note}</p>` : ''}
  ${shots.join('')}
</section>`;
}

// ------------------------------------------------------------------ diagrams

const flowBoxes = [
  ['1', 'Employer promises', 'accommodations on the job posting'],
  ['2', 'Hire confirmed', 'by both sides, with a start date'],
  ['3', '30 days of work', 'the rating stays locked'],
  ['4', 'Employee rates', 'each promised accommodation'],
  ['5', '3 responses', 'needed before a score shows'],
  ['6', 'Score published', 'on job cards and the employer page'],
];
const flowDiagram = `<svg class="diagram" viewBox="0 0 720 200" role="img" aria-label="Trust score in six steps: ${flowBoxes.map((box) => box[1]).join(', ')}">
  <defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#47306f"/></marker></defs>
  <g font-family="Segoe UI, Arial, sans-serif" fill="#1f2328">
  ${flowBoxes
    .map(([no, title, text], index) => {
      const x = 10 + (index % 3) * 245;
      const y = index < 3 ? 15 : 115;
      const dark = index === 5;
      return `<rect x="${x}" y="${y}" width="205" height="70" rx="8" fill="${dark ? '#6a4c9c' : '#f3effa'}" stroke="#6a4c9c"/>
      <circle cx="${x + 22}" cy="${y + 35}" r="12" fill="${dark ? '#fff' : '#6a4c9c'}"/><text x="${x + 22}" y="${y + 39.5}" text-anchor="middle" font-size="12" font-weight="700" fill="${dark ? '#6a4c9c' : '#fff'}">${no}</text>
      <text x="${x + 42}" y="${y + 31}" font-size="12.5" font-weight="700" fill="${dark ? '#fff' : '#1f2328'}">${title}</text>
      <text x="${x + 42}" y="${y + 49}" font-size="10" fill="${dark ? '#fff' : '#3a4048'}">${text}</text>`;
    })
    .join('')}
  <g stroke="#47306f" stroke-width="1.6" fill="none" marker-end="url(#ar)">
    <path d="M215 50 H253"/><path d="M460 50 H498"/><path d="M600 85 V100 H112 V113"/><path d="M215 150 H253"/><path d="M460 150 H498"/>
  </g>
  </g>
</svg>`;

/** The 30-day clock with the dates of the walkthrough's hire. */
function clockDiagram(start, opens) {
  const x0 = 45;
  const unit = 14; // px per day, day −7 … day 31.6, leaves room for "open, no deadline"
  const at = (offset) => x0 + (offset + 7) * unit;
  const ticks = [-7, 0, 7, 14, 21, 30];
  return `<svg class="diagram" viewBox="0 0 720 165" role="img" aria-label="Timeline: hire confirmed ${day(appliedOn)}, start date ${day(start)} is day 0, rating opens on day 30, ${day(opens)}">
  <g font-family="Segoe UI, Arial, sans-serif" fill="#1f2328">
    <rect x="${at(0)}" y="62" width="${at(30) - at(0)}" height="16" fill="#f3effa" stroke="#b9a6d9"/>
    <text x="${(at(0) + at(30)) / 2}" y="74" text-anchor="middle" font-size="10" fill="#47306f">rating locked – the employee works with the accommodations</text>
    <rect x="${at(30)}" y="62" width="${at(31.6) - at(30)}" height="16" fill="#1a7f37"/>
    ${ticks
      .map((offset) => `<line x1="${at(offset)}" y1="${offset === 0 || offset === 30 ? 56 : 78}" x2="${at(offset)}" y2="84" stroke="#47306f" stroke-width="${offset === 0 || offset === 30 ? 2 : 1}"/>
      <text x="${at(offset)}" y="98" text-anchor="middle" font-size="10" font-weight="${offset === 0 || offset === 30 ? 700 : 400}">day ${offset}</text>
      <text x="${at(offset)}" y="112" text-anchor="middle" font-size="9.5" fill="#57606a">${shortDay(addDays(start, offset))}</text>`)
      .join('')}
    <text x="${at(-7)}" y="40" text-anchor="middle" font-size="10.5" font-weight="700">Hire confirmed</text>
    <text x="${at(-7)}" y="52" text-anchor="middle" font-size="9.5" fill="#57606a">(start date agreed)</text>
    <text x="${at(0)}" y="28" text-anchor="middle" font-size="10.5" font-weight="700">Start date</text>
    <text x="${at(0)}" y="40" text-anchor="middle" font-size="9.5" fill="#57606a">first working day</text>
    <text x="${at(30) - 4}" y="28" text-anchor="end" font-size="10.5" font-weight="700" fill="#1a7f37">Rating opens</text>
    <text x="${at(30) - 4}" y="40" text-anchor="end" font-size="9.5" fill="#57606a">00:00 Manila · reminder at 08:00</text>
    <text x="${at(31.6) + 6}" y="74" font-size="10" fill="#1a7f37">open, no deadline</text>
    <text x="${x0}" y="138" font-size="10" fill="#3a4048">Opens on = start date + 30 calendar days (weekends and holidays count).</text>
    <text x="${x0}" y="153" font-size="10" fill="#3a4048">Before that, the form answers “Not open yet” and the API refuses a rating with 422 FEEDBACK_NOT_OPEN.</text>
  </g>
</svg>`;
}

// ------------------------------------------------------------------ calculation

const breakdown = F.score_after.breakdown;
const rows = breakdown.map((item) => ({ ...item, points: item.delivered + item.partial * 0.5 }));
const totalItems = rows.reduce((sum, row) => sum + row.of, 0);
const totalPoints = rows.reduce((sum, row) => sum + row.points, 0);
const computed = Math.round((totalPoints / totalItems) * 100);
const number = (value) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

const calcTable = `<table class="grid">
  <thead><tr><th>Accommodation</th><th>Delivered (1 point)</th><th>Partly (½ point)</th><th>Not delivered (0)</th><th>Rated</th><th>Points</th></tr></thead>
  <tbody>${rows
    .map((row) => `<tr><th>${esc(row.name)}</th><td>${row.delivered}</td><td>${row.partial}</td><td>${row.not_delivered}</td><td>${row.of}</td><td>${number(row.points)}</td></tr>`)
    .join('')}
  <tr><th>All responses</th><td></td><td></td><td></td><td><b>${totalItems}</b></td><td><b>${number(totalPoints)}</b></td></tr></tbody>
</table>`;

// ------------------------------------------------------------------ sections

const cover = `<section class="cover">
  <div class="cover__band"><span class="cover__brand">OpenDoor</span><span class="cover__kind">Trust Score Guide</span></div>
  <h1 class="cover__title">Trust Score Guide</h1>
  <div class="cover__subtitle">How hired employees confirm whether employers kept their accommodation promises</div>
  <p class="cover__purpose">The whole process for job seekers and employers, screen by screen: from the promise on the job posting,
  through the confirmed hire and the 30-day wait, to the anonymous rating and the published score.</p>
  <table class="cover__meta">
    <tr><th>Covers</th><td>Job seekers (candidates), employers, administrators</td></tr>
    <tr><th>Screens</th><td>Captured ${captured} on a local, freshly seeded stack (test database, demo accounts)</td></tr>
    <tr><th>Version</th><td>${generated} · commit <code>${commit}</code></td></tr>
  </table>
  <div class="cover__project">OpenDoor – PWD job matching by workplace accommodations · SIA 1 and IPT final project · Group 3 – ICARUS, IT31S1</div>
</section>`;

const toc = [
  ['glance', '1', 'The trust score at a glance'],
  ['clock', '2', 'How the 30 days work'],
  ['candidate', '3', 'Job seeker: from applying to rating'],
  ['employer', '4', 'Employer: reporting the hire and the score'],
  ['admin', '5', 'Administrator: moderating responses'],
  ['calc', '6', 'How the score is calculated'],
  ['faq', '7', 'Questions and special cases'],
  ['tech', '8', 'For developers: endpoints and rules'],
];
const contents = `<section class="toc"><h1>Contents</h1><ul class="toc__list">${toc
  .map(([id, no, title]) => `<li class="toc__main"><a href="#${id}"><span class="toc__no">${no}</span>${title}</a></li>`)
  .join('')}</ul>
  <h2>The story in this guide</h2>
  <p>All screens come from one run through the real system. Two stories are used, so that every stage can be shown without changing any dates:</p>
  ${list([
    `<b>Story A – a new hire (steps 3.1–3.9 and 4.1–4.3).</b> Maria Santos (<code>candidate@</code>) applies for <i>Junior Web Developer</i> at Bayanihan Tech Solutions (<code>employer@</code>). The employer reports the hire with a start date of <b>${day(F.start_date)}</b>; Maria confirms it. Her rating opens on <b>${day(F.feedback_opens_on)}</b> – until then it is locked.`,
    `<b>Story B – 30 days later (steps 3.10–3.13, 4.4–4.5 and 5.1).</b> Juan Dela Cruz (<code>candidate2@</code>) was hired as <i>${esc(F.hire2.title)}</i> at ${esc(F.hire2.company)} (<code>employer2@</code>), starting <b>${day(F.hire2.hire_start_date)}</b>. His rating opened on <b>${day(F.hire2.feedback_opens_on)}</b>. ${esc(F.hire2.company)} had 2 responses, so its score was hidden; Juan’s rating is the 3rd and publishes it.`,
  ])}
</section>`;

const glance = `<section class="chapter" id="glance">
<h1>1 The trust score at a glance</h1>
<p class="lead">An employer’s trust score answers one question for job seekers: <b>when this employer promised a workplace accommodation, was it really provided?</b>
Only people the employer actually hired can answer, and only after they have worked there for 30 days.</p>
${flowDiagram}
<table class="grid">
  <tbody>
    <tr><th>Who can rate</th><td>Only a <b>confirmed hire</b>: the application must be <i>Hired</i>, which needs both the employer and the job seeker to confirm it (steps 3.6–3.8). Nobody else – not other job seekers, not the employer, not admins.</td></tr>
    <tr><th>When</th><td>From <b>calendar day 30 after the confirmed start date</b> (Philippine time). No deadline after that. One rating per hire.</td></tr>
    <tr><th>What is rated</th><td>Each accommodation the job posting listed <b>when the hire was confirmed</b> (saved at that moment, so later edits to the posting do not change the form). Every item needs an answer.</td></tr>
    <tr><th>Answers</th><td><b>Delivered</b> = 1 point · <b>Partly delivered</b> = ½ point · <b>Not delivered</b> = 0 points. An optional comment (no names).</td></tr>
    <tr><th>Score</th><td>Points ÷ number of rated items × 100, rounded to a whole percent, over all of the employer’s responses (section 6).</td></tr>
    <tr><th>Shown from</th><td><b>3 responses</b>. Below that the score and the per-accommodation table are hidden for everyone, including the employer (“Not published yet … 2 of 3 so far”).</td></tr>
    <tr><th>Privacy</th><td>Answers are <b>anonymous</b>. The employer sees only the combined score and counts per accommodation – never who answered or what one person said.</td></tr>
    <tr><th>Moderation</th><td>Admins can hide abusive, off-topic or clearly false responses; the score is recalculated at once.</td></tr>
  </tbody>
</table>
</section>`;

const clock = `<section class="chapter" id="clock">
<h1>2 How the 30 days work</h1>
<p class="lead">The 30 days give the new employee time to actually work with the accommodations before judging them. The clock starts on the
<b>start date both sides confirmed</b> – not on the day of the application, and not on the day the hire was confirmed.</p>
<h2>The walkthrough’s dates</h2>
${clockDiagram(F.hire_start_date, F.feedback_opens_on)}
<table class="grid">
  <thead><tr><th>Hire</th><th>Confirmed</th><th>Start date (day 0)</th><th>Rating opens (day 30)</th><th>Status on ${captured}</th></tr></thead>
  <tbody>
    <tr><th>Story A: Maria · Junior Web Developer</th><td>${day(appliedOn)}</td><td>${day(F.hire_start_date)}</td><td>${day(F.feedback_opens_on)}</td><td>Locked – “Not open yet” (step 3.9)</td></tr>
    <tr><th>Story B: Juan · ${esc(F.hire2.title)}</th><td>on the start date (demo data)</td><td>${day(F.hire2.hire_start_date)}</td><td>${day(F.hire2.feedback_opens_on)}</td><td>Open – reminder sent, rated (steps 3.10–3.12)</td></tr>
    <tr><th>Rule example</th><td>–</td><td>October 1</td><td>October 31</td><td>–</td></tr>
  </tbody>
</table>
<h2>Step by step</h2>
${list([
  '<b>Start date.</b> Whoever reports the hire enters the first working day. It may be any day from the application date up to 365 days ahead – so it can be in the future (Story A) or already past.',
  '<b>Confirmation.</b> The other side answers <i>Confirm</i>. Only then does the application become <i>Hired</i> and the clock count from the start date. The promised accommodations are saved at this moment.',
  '<b>Days 0–29.</b> The job seeker’s application shows “You can rate the accommodations from <i>date</i>”. Opening the form shows “Not open yet”; the server refuses a rating with <code>422 FEEDBACK_NOT_OPEN</code>.',
  '<b>Day 30, 00:00 Philippine time.</b> The form opens. Calendar days count – weekends and holidays included.',
  '<b>Day 30, 08:00.</b> A daily job (<code>feedback:remind</code>) sends the job seeker one in-app notice – and an email if email notifications are on – saying the rating is open. Each hire is reminded once; a missed day is caught up the next morning.',
  '<b>After day 30.</b> The form stays open with no deadline until the job seeker rates. Once rated, the form says “Already rated”.',
])}
<h2>What changes the date</h2>
<table class="grid">
  <tbody>
    <tr><th>“Not yet” with a new start date</th><td>The report stays open with the new date. When it is confirmed, day 0 is the new date.</td></tr>
    <tr><th>“Incorrect”</th><td>No hire, no clock. The application stays at its stage; either side can report again.</td></tr>
    <tr><th>Withdrawn / not selected while a report is open</th><td>The open report is cancelled. No hire, no rating.</td></tr>
    <tr><th>Job closed after the hire</th><td>Nothing changes: the hire stays confirmed and the rating opens on day 30.</td></tr>
  </tbody>
</table>
</section>`;

const candidate = `<section class="chapter" id="candidate">
<h1>3 Job seeker: from applying to rating</h1>
<p class="lead">Story A shows the job seeker’s side up to the locked rating; Story B continues on day 30 with the reminder and the rating itself.</p>
${step('3.1', 'Guest or job seeker', 'See an employer’s trust score before applying', {
  does: 'Every job card shows the employer’s score in its corner: the percentage and the number of ratings, or “Not rated yet” while fewer than 3 hired employees have answered.',
  shots: [figure(F.card, 'Find jobs: the card shows Bayanihan Tech Solutions’ published score (79 %, 3 ratings).')],
})}
${step('3.2', 'Guest or job seeker', 'Read the promises and the score on the job page', {
  does: 'The job page lists the accommodations this employer promises for the job – exactly what a hired employee will rate later. “About the employer” repeats the score and links to the explanation.',
  shots: [figure(F.promises, 'Job details → Workplace accommodations: the promises.'), figure(F.employer_card, 'Job details → About the employer: verification and trust score.')],
})}
${step('3.3', 'Anyone', 'How trust scores work (public page)', {
  does: 'The footer and the score cards link to a plain-language page explaining the rules in this guide.',
  shots: [figure(F.explainer, 'The public “How trust scores work” page (/trust-scores).')],
})}
${step('3.4', 'Job seeker', 'Apply', {
  does: 'Maria applies with her saved résumé and a cover note. An application alone does not count for the trust score – only a confirmed hire does.',
  shots: [figure(F.apply_form, 'Apply for this job.', { width: '48%' }), figure(F.applied, 'Application sent.')],
})}
${step('3.5', 'Job seeker', 'Get the employer’s hiring report', {
  does: 'After the employer reports the hire (step 4.2), Maria gets a notice. The link opens her application.',
  shots: [figure(F.notice_report, 'Notifications: the employer reported the hire.')],
})}
${step('3.6', 'Job seeker', 'Check the report: Confirm, Not yet or Incorrect', {
  does: `The employer says Maria was hired, starting ${day(F.start_date)}. She can <b>Confirm</b> it, answer <b>Not yet</b> (optionally with a new start date) or say it is <b>Incorrect</b>. Nothing is ever confirmed automatically.`,
  system: 'every report and answer is kept as history; only one report can be open per application.',
  shots: [figure(F.confirm_choice, 'Hiring confirmation as the job seeker sees it, with the history.')],
})}
${step('3.7', 'Job seeker', 'Confirm the hire', {
  does: 'The confirmation dialog says what happens next – including the 30-day rule – and that it cannot be undone.',
  shots: [figure(F.confirm_dialog, 'Confirm the hire?', { width: '62%' })],
})}
${step('3.8', 'Job seeker', 'Hired – the 30-day clock starts', {
  does: `The application is now <b>Hired</b>, start date ${day(F.hire_start_date)}. The page tells Maria when she can rate: <b>${day(F.feedback_opens_on)}</b>.`,
  system: `the application gets <code>hired_at</code> (the moment of confirmation), <code>hire_start_date</code> ${F.hire_start_date}, and the posting’s accommodations are saved for the form. <code>feedback_opens_on</code> = ${F.feedback_opens_on}.`,
  shots: [figure(F.hired_page, 'The application after confirming: Hired, start date, timeline and history.'), figure(F.rating_prompt, 'The rating card: opens 30 days after the start date.')],
})}
${step('3.9', 'Job seeker', 'Before day 30: the form is locked', {
  does: 'Opening the rating form early only shows when it opens. The server refuses an early rating as well, so the rule cannot be bypassed.',
  shots: [figure(F.not_open, `Rate your accommodations → “Not open yet” (before ${day(F.feedback_opens_on)}).`)],
})}
${step('3.10', 'Job seeker (day 30+)', 'The reminder', {
  does: `Story B. Juan’s start date was ${day(F.hire2.hire_start_date)}, so his form opened on ${day(F.hire2.feedback_opens_on)}. The morning job sends him one notice.`,
  system: `<code>php artisan feedback:remind</code> runs daily at 08:00 (in the capture it was run once by hand: “${esc(F.remind_output)}”).`,
  shots: [figure(F.notice_reminder, 'Notifications: “You can now rate the accommodations …”.'), figure(F.rating_open, 'His application now shows “Rate accommodations”.')],
})}
${step('3.11', 'Job seeker (day 30+)', 'Rate each promised accommodation', {
  does: 'One question per accommodation the posting listed when he was hired: Delivered, Partly delivered or Not delivered. Every item needs an answer; the comment is optional and should not name anyone.',
  shots: [figure(F.form_empty, 'The rating form.'), figure(F.form_filled, `Juan’s answers: ${F.ratings_given.map((item) => `${esc(item.name)} – ${item.rating}`).join('; ')}.`)],
})}
${step('3.12', 'Job seeker (day 30+)', 'Submit', {
  does: 'The ratings are saved. Juan’s name is not attached to anything the employer can see.',
  system: 'the ratings and the comment are stored in one transaction; an observer recalculates the employer’s score right after.',
  shots: [figure(F.thanks, 'Thank you – ratings saved.')],
})}
${step('3.13', 'Job seeker', 'Only once per hire', {
  does: 'Opening the form again shows “Already rated”. A second rating is refused by the server (409 FEEDBACK_EXISTS).',
  shots: [figure(F.already, 'Already rated.')],
})}
</section>`;

const employer = `<section class="chapter" id="employer">
<h1>4 Employer: reporting the hire and the score</h1>
<p class="lead">The employer cannot rate itself and cannot see individual answers. Its part is to report (or confirm) the hire honestly and keep its promises.</p>
${step('4.1', 'Employer', 'Open the application', {
  does: 'Opening an application marks it <i>Under review</i>. The Hiring confirmation card offers “Report hiring”.',
  shots: [figure(F.employer_before, 'Hiring confirmation on the employer’s application page.')],
})}
${step('4.2', 'Employer', 'Report hiring with the start date', {
  does: `The employer enters the first working day – here ${day(F.start_date)}. The job seeker is asked to confirm it. (A job seeker can also report the hire first; then the employer confirms.)`,
  shots: [figure(F.report_dialog, 'Report hiring: the start date.', { width: '62%' }), figure(F.reported, 'Reported – waiting for the applicant. Nothing changes until then.')],
})}
${step('4.3', 'Employer', 'The hire is confirmed', {
  does: 'After Maria confirms, the employer’s page shows “Hired — confirmed” with the start date and the full history. The employer’s dashboard counts it as a confirmed hire.',
  shots: [figure(F.employer_hired, 'The employer’s view after confirmation.')],
})}
${step('4.4', 'Employer', 'Below 3 responses: not published', {
  does: `${esc(F.hire2.company)} has ${F.score_before.based_on} responses. The score and the per-accommodation table stay hidden – for job seekers and for the employer itself.`,
  system: `<code>GET /employers/${F.employer2_id}/trust-score</code> → <code>${esc(JSON.stringify(F.score_before))}</code>`,
  shots: [figure(F.score_before_shot, 'Trust score: “Not published yet … (2 of 3 so far)”.')],
})}
${step('4.5', 'Employer', 'The 3rd response publishes the score', {
  does: `Right after Juan’s rating the employer sees <b>${F.score_after.score}%</b>, based on ${F.score_after.based_on} responses, and counts per accommodation – which promise was kept and which was not. No names, no single answers.`,
  system: `the same endpoint now returns <code>published: true, score: ${F.score_after.score}, based_on: ${F.score_after.based_on}</code> with the breakdown (section 6).`,
  shots: [figure(F.score_after_shot, 'Trust score page after the 3rd response.'), figure(F.dashboard_card, 'The same score on the employer dashboard.', { width: '55%' })],
})}
</section>`;

const admin = `<section class="chapter" id="admin">
<h1>5 Administrator: moderating responses</h1>
${step('5.1', 'Administrator', 'Review and hide responses if needed', {
  does: 'Admins see every response with its ratings and comment, so they can hide abusive, off-topic or clearly false ones. Hiding (or showing again) recalculates the score at once; if fewer than 3 visible responses remain, the score is unpublished again.',
  system: '<code>PATCH /admin/feedback/{id}/hide</code> with <code>{"hidden": true|false}</code>. Admins cannot write or change ratings.',
  shots: [figure(F.admin_feedback, 'Admin → Feedback: Juan’s new response on top.')],
})}
</section>`;

const calc = `<section class="chapter" id="calc">
<h1>6 How the score is calculated</h1>
<p class="lead">Every rated item counts the same, across all of the employer’s visible responses:</p>
<p class="formula">trust score = round( (Delivered × 1 + Partly × ½ + Not delivered × 0) ÷ items rated × 100 )</p>
<h2>Worked example: ${esc(F.hire2.company)} after the 3rd response</h2>
${calcTable}
<p>${number(totalPoints)} points ÷ ${totalItems} rated items = ${(totalPoints / totalItems).toFixed(4)} → × 100 = ${((totalPoints / totalItems) * 100).toFixed(2)} → rounded: <b>${computed}%</b>
${computed === F.score_after.score ? '– the same as the system shows (step 4.5).' : `<b>(the system shows ${F.score_after.score}% – check the capture)</b>`}</p>
${list([
  'The score is a whole percentage (0–100), rounded half up (77.5 → 78).',
  'With 2 responses the same employer had no score at all – the threshold of 3 protects against one unlucky or unfair answer and makes it harder to guess who answered.',
  'The counts per accommodation show employers exactly which promise to fix; here: the adjustable workstation.',
  'Responses stay counted if the job posting is later deleted; hidden responses do not count.',
])}
</section>`;

const faq = `<section class="chapter" id="faq">
<h1>7 Questions and special cases</h1>
<table class="grid">
  <tbody>
    <tr><th>Can an employer rate itself or push its score up?</th><td>No. Only the hired job seeker can rate, only after both sides confirmed the hire, once per hire, and only from day 30.</td></tr>
    <tr><th>What if the employer claims a hire that did not happen?</th><td>The job seeker answers “Incorrect”. Without both confirmations there is no hire and no rating.</td></tr>
    <tr><th>What if the start date moves?</th><td>Answer “Not yet” with the new date. The 30 days count from the date that is finally confirmed.</td></tr>
    <tr><th>The employee left before day 30.</th><td>The hire stays confirmed; the rating still opens on day 30 and they can tell whether the promises were kept while they worked there.</td></tr>
    <tr><th>The employer edits the posting after the hire.</th><td>The form uses the accommodations saved when the hire was confirmed, so promises cannot be removed afterwards.</td></tr>
    <tr><th>The posting promised no accommodations.</th><td>Nothing to rate – the form says so – and the hire does not affect the score.</td></tr>
    <tr><th>Can the employer find out who rated?</th><td>No. It sees only the combined score and counts per accommodation, published from 3 responses. Comments are seen by admins only.</td></tr>
    <tr><th>Is there a deadline to rate?</th><td>No. The form stays open after day 30 until the job seeker rates.</td></tr>
    <tr><th>Why did this guide not wait 30 days?</th><td>Story B uses a hire from the demo data whose start date was ${day(F.hire2.hire_start_date)}; its window was really open on the capture day. No dates were changed.</td></tr>
  </tbody>
</table>
</section>`;

const tech = `<section class="chapter" id="tech">
<h1>8 For developers: endpoints and rules</h1>
<table class="grid">
  <thead><tr><th>Step</th><th>Call (through the gateway, <code>/api</code>)</th><th>Rule / error</th></tr></thead>
  <tbody>
    <tr><td>Report hire</td><td><code>POST /applications/{id}/hiring-reports</code> <code>{start_date}</code></td><td>Application date ≤ start date ≤ today + 365; one open report (409 HIRING_REPORT_PENDING)</td></tr>
    <tr><td>Answer</td><td><code>POST /applications/{id}/hiring-reports/{report}/response</code> <code>{answer: confirm|not_yet|incorrect, start_date?}</code></td><td>Only the other party (reporter → 403); closed report → 409 HIRING_REPORT_CLOSED</td></tr>
    <tr><td>Form</td><td><code>GET /applications/{id}/feedback-form</code></td><td><code>is_open</code>, <code>opens_on</code>, <code>submitted</code>, items saved at the hire</td></tr>
    <tr><td>Rate</td><td><code>POST /applications/{id}/feedback</code> <code>{items:[{accommodation_id, rating}], comments?}</code></td><td>Hired + day ≥ 30 (422 FEEDBACK_NOT_OPEN); once (409 FEEDBACK_EXISTS); every item rated</td></tr>
    <tr><td>Score</td><td><code>GET /employers/{id}/trust-score</code></td><td>Same answer for everyone; <code>published</code> from 3 visible responses</td></tr>
    <tr><td>Moderate</td><td><code>PATCH /admin/feedback/{id}/hide</code> <code>{hidden}</code></td><td>Admins only; recalculates</td></tr>
    <tr><td>Reminder</td><td><code>php artisan feedback:remind</code> (scheduler, daily 08:00 Manila)</td><td>Once per hire, when the form is open; in-app notice + email if switched on</td></tr>
  </tbody>
</table>
${list([
  '<code>feedback_opens_on</code> = <code>hire_start_date</code> + 30 days, Asia/Manila (<code>Application::feedbackOpensOn()</code>).',
  'Score recalculation: <code>FeedbackObserver</code> after each save, hide or unhide → <code>employers.trust_score</code>, <code>feedback_count</code>.',
  'Rebuild this guide: reseed the test database, run Core on it, then in <code>tests/a11y</code>: <code>DEMO_PASSWORD=… npm run trust-guide</code>.',
])}
</section>`;

const extraCss = `
.tstep { break-inside: auto; margin: 0 0 5mm; }
.tstep h3 { font-size: 11.5pt; margin: 5mm 0 2mm; padding: 1.6mm 2.5mm; background: #f6f8fa; border-left: 2.5pt solid #6a4c9c; break-after: avoid; }
.tstep .role { float: right; font-size: 8.5pt; font-weight: 600; color: #57606a; }
.behind { font-size: 8.8pt; color: #3a4048; }
.formula { font-family: Consolas, monospace; font-size: 10pt; background: #f3effa; border: 0.5pt solid #b9a6d9; padding: 2.5mm 3mm; border-radius: 1.5mm; }
figure.shot img { max-height: 150mm; }
`;

const body = `${cover}${contents}${glance}${clock}${candidate}${employer}${admin}${calc}${faq}${tech}`;
const htmlFile = join(CAPTURE, 'trust-score-guide.html');
await printPdf({ title: 'OpenDoor – Trust Score Guide', body, htmlFile, pdf: PDF, footer: `OpenDoor Trust Score Guide · ${generated} · ${commit}`, extraCss });
console.log(`PDF: ${PDF}`);
