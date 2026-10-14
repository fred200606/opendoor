const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, ImageRun, LevelFormat, BorderStyle, Footer, PageNumber,
} = require("docx");

const OUTDIR = require("path").resolve(__dirname, "..").split("\\").join("/") + "/"; // docs/ (parent of diagrams/)
const GOLD = "BF9000", DARK = "434343", FONT = "Arial";
const W = 10080; // content width (Letter, 0.75in margins)

// ---------- inline parser: [[placeholder]] -> yellow, **bold**, `code` ----------
function runs(text, base = {}) {
  const out = [];
  String(text).split(/(\[\[.*?\]\]|\*\*.*?\*\*|`.*?`)/).forEach((seg) => {
    if (!seg) return;
    if (seg.startsWith("[[")) out.push(new TextRun({ ...base, text: "[" + seg.slice(2, -2) + "]", highlight: "yellow" }));
    else if (seg.startsWith("**")) out.push(new TextRun({ ...base, text: seg.slice(2, -2), bold: true }));
    else if (seg.startsWith("`")) out.push(new TextRun({ ...base, text: seg.slice(1, -1), font: "Consolas" }));
    else out.push(new TextRun({ ...base, text: seg }));
  });
  return out;
}
const P = (t, o = {}) => new Paragraph({ children: runs(t, o.run || {}), spacing: { after: 120, line: 276 }, alignment: o.align, ...(o.p || {}) });
// Every top-level section starts on a new page. pageBreakBefore (not a PageBreak paragraph) never
// leaves a blank page when the previous page is exactly full.
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const bullets = (arr, lvl = 0) => arr.map((t) => new Paragraph({ numbering: { reference: "bul", level: lvl }, children: runs(t), spacing: { after: 60 } }));
let numRef = 0;
const numbered = (arr) => { const ref = "num" + (numRef++ % 20); return arr.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(t), spacing: { after: 60 } })); };
const note = (t) => new Paragraph({ children: runs(t, { italics: true, size: 18, color: "555555" }), spacing: { after: 120 } });

const border = { style: BorderStyle.SINGLE, size: 4, color: "7F7F7F" };
const borders = { top: border, bottom: border, left: border, right: border };
function cell(text, width, opts = {}) {
  const paras = String(text).split("\n").map((line) =>
    new Paragraph({ children: runs(line, { size: opts.size || 18, bold: opts.bold, color: opts.color, font: opts.font }), spacing: { after: 20 } }));
  return new TableCell({
    width: { size: width, type: WidthType.DXA }, borders,
    shading: opts.fill ? { type: ShadingType.CLEAR, color: "auto", fill: opts.fill } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: paras,
  });
}
function table(headers, rows, widths, opts = {}) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum !== W) widths = widths.map((w) => Math.round((w * W) / sum)), widths[widths.length - 1] += W - widths.reduce((a, b) => a + b, 0);
  const trs = [];
  if (headers) trs.push(new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, widths[i], { bold: true, color: "FFFFFF", fill: DARK })) }));
  rows.forEach((r) => trs.push(new TableRow({ children: r.map((c, i) => cell(c, widths[i], opts.kv && i === 0 ? { bold: true, fill: "F2F2F2" } : { size: opts.size })) })));
  return [new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: widths, rows: trs }), new Paragraph({ spacing: { after: 120 }, children: [] })];
}
function code(text) {
  const lines = text.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  return [new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: W, type: WidthType.DXA }, borders: { top: border, bottom: border, left: border, right: border },
      shading: { type: ShadingType.CLEAR, color: "auto", fill: "F5F5F5" }, margins: { top: 80, bottom: 80, left: 140, right: 140 },
      children: lines.map((l) => new Paragraph({ spacing: { after: 0, line: 240 }, children: [new TextRun({ text: l || " ", font: "Consolas", size: 16 })] })),
    })] })],
  }), new Paragraph({ spacing: { after: 120 }, children: [] })];
}
let figNo = 0;
function fig(file, wPx, hPx, caption) {
  figNo++;
  const width = 660, height = Math.round((hPx / wPx) * 660);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new ImageRun({ type: "png", data: fs.readFileSync(OUTDIR + "diagrams/" + file), transformation: { width, height } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: `Figure ${figNo}. ${caption}`, italics: true, size: 18 })] }),
  ];
}
const screenshotSlot = (caption, fn) => [
  ...table(null, [[`[[Insert screenshot: ${caption}]]\n\n\n`]], [W]),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: `Screen: ${caption}`, italics: true, size: 18 })] }),
  P(fn),
];

// =====================================================================
const C = [];

// ---------- Title page ----------
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }, children: [new TextRun({ text: "SYSTEMS INTEGRATION AND ARCHITECTURE 1", bold: true, size: 20 })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: "OPENDOOR", bold: true, size: 56, color: GOLD })] }));
C.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "An Integrated Job Matching Platform with Accommodation-Based Filtering and Post-Hire Accommodation Verification for Persons with Disabilities", bold: true, size: 26, color: GOLD })] }));

// ---------- Project information ----------
C.push(H1("Project Information"));
C.push(...table(["Field", "Details"], [
  ["Project Title", "OpenDoor: An Integrated Job Matching Platform with Accommodation-Based Filtering and Post-Hire Accommodation Verification for Persons with Disabilities"],
  ["Selected UN SDG", "SDG 8 – Decent Work and Economic Growth (Target 8.5)"],
  ["Course", "Systems Integration and Architecture 1"],
  ["Section", "[[Enter section]]"],
  ["Instructor", "[[Enter instructor name]]"],
  ["Group Name / Number", "[[Enter group name or number]]"],
  ["Submission Date", "[[Month Day, Year]]"],
], [2600, 7480], { kv: true }));
C.push(H2("Group Members"));
C.push(...table(["Name", "Student Number", "Primary Role / Responsibility"], [
  ["[[Name]]", "[[Student No.]]", "Project lead and integration architect – API gateway, service contracts, CI/CD"],
  ["[[Name]]", "[[Student No.]]", "Core Service developer – Laravel API, MySQL schema, matching and trust score"],
  ["[[Name]]", "[[Student No.]]", "Integration developer – Accessibility Insights mashup and SOAP Business Registry"],
  ["[[Name]]", "[[Student No.]]", "Frontend developer – React SPA, accessibility (WCAG 2.1 AA)"],
  ["[[Name]]", "[[Student No.]]", "QA and DevOps – Postman/Newman, JMeter, cloud deployment, documentation"],
], [3000, 2200, 4880]));
C.push(note("Note: the role split above is a suggested division of the five integration workstreams. Adjust it to match the actual group."));
C.push(H2("Document Control"));
C.push(...table(["Field", "Information"], [
  ["Application Platform", "Web (responsive single-page application usable on desktop and on 360 px phone screens)"],
  ["Repository", "[[Insert repository link, e.g., https://github.com/<org>/opendoor]]"],
  ["Deployment / Access URL", "Frontend: [[https://opendoor.vercel.app]]  ·  API Gateway: [[https://opendoor-gateway.up.railway.app/api]]"],
  ["Version", "1.0"],
  ["Date", "[[Insert date]]"],
], [2600, 7480], { kv: true }));

// ---------- Executive summary ----------
C.push(H1("Executive Summary"));
C.push(P("Persons with disabilities (PWDs) remain largely excluded from the Philippine workforce: of about 1.9 million working-age Filipinos with a disability, only around 353,000 were in the labor force in January 2022 (Rappler, 2023). Republic Act No. 7277 already requires reasonable accommodation, yet the information a PWD job seeker needs to act on that right is scattered across systems that do not exchange data. Accommodation details are buried in free-text postings on separate job boards, employer legitimacy is checked by hand against DTI and SEC registry websites, the accessibility of a workplace's surroundings is looked up separately on maps, and no system records whether advertised accommodations were actually delivered after hire."));
C.push(P("**OpenDoor** integrates these sources into one web application aligned with **SDG 8, Target 8.5** (full and productive employment and decent work for all, including persons with disabilities). Candidates record their accommodation needs once and see job postings ranked by how many needs each one meets (\"Meets 4 of 5 of your needs\"). Employers post jobs with structured accommodation fields and move applicants through a server-enforced status workflow. After hire, candidates rate each advertised accommodation, producing an anonymous **accommodation trust score** that is published only after three responses."));
C.push(P("The final architecture uses an **API Gateway** (Node.js/Express) as the single entry point for a **React** single-page application. Behind the gateway, the **Core Service** (Laravel 13, Sanctum, MySQL 8) owns users, profiles, postings, matching, applications, feedback and moderation. An **Accessibility Insights Service** (Node.js) is a mashup that combines the posting's address and accommodations from the Core Service with three external REST APIs – OpenStreetMap **Nominatim** (geocoding), the **Overpass API** (wheelchair-tagged places nearby) and the **PSGC API** (official Philippine location codes) – into a normalized \"Workplace Accessibility Snapshot\". A **Business Registry Service** exposes a WSDL-described **SOAP 1.1** interface that simulates a legacy DTI/SEC registry; the Core Service calls it with XML and WS-Security credentials during employer verification and maps the XML result to JSON."));
C.push(P("All services are deployed to the cloud: the React app on Vercel and the gateway, services and MySQL on Railway, with only the gateway exposed publicly and the other services on a private network. GitHub Actions runs linting, unit and feature tests, React builds and a Newman (Postman) API test run on every pull request, and the Vercel and Railway GitHub integrations deploy the main branch. Quality is verified through a Postman collection with assertions on status codes, identifiers, business values and application error codes, and through an Apache JMeter load test of the matching endpoint. The outcome is a deployed, accessible platform in which integration – not a single database – lets PWDs find jobs that fit their needs and lets the community hold employers to their accommodation promises."));
C.push(note("[[Update the final paragraph with the measured results (test pass rate, JMeter P95 and error rate, SUS score) once testing is complete.]]"));

// ---------- 1 Project Overview ----------
C.push(H1("1. Project Overview"));
C.push(H2("1.1 Background and Problem"));
C.push(P("Philippine law recognizes that the employment of PWDs depends on workplace accommodation. Republic Act No. 7277 (Magna Carta for Disabled Persons) defines reasonable accommodation as accessible facilities, modified work schedules, acquired or modified equipment, adjusted training materials and policies, and auxiliary aids and services, and Republic Act No. 10524 reserves at least 1% of government positions for PWDs. In practice, studies report low quota compliance, limited employer awareness, and a lack of accommodation facilities and assistive technology. The 2016 National Disability Prevalence Survey found that 78% of PWDs were unemployed or in the informal sector (SDDirect, 2023)."));
C.push(P("Several channels already exist. DOLE's PhilJobNet and the PESO Employment Information System keep a national job-seeker registry, and PWD-focused platforms such as PWD-E and Access Careers match candidates on skills, location, disability type, work mode and shift. The problem is that these sources are **not integrated** with the information that actually decides whether a PWD can take a job:"));
C.push(...bullets([
  "Accommodations are written as free text inside postings on separate boards, so they cannot be filtered or matched, and the same profile must be re-entered on every board.",
  "Employer legitimacy is verified manually by visiting DTI BNRS or SEC registry websites; nothing links a job posting to registry data.",
  "Whether a workplace's surroundings are accessible (ramps, accessible transport stops, accessible toilets and parking) has to be checked separately on map services.",
  "No system closes the loop after hire: there is no record of whether the accommodations an employer advertised were delivered, so a candidate often learns of a mismatch only at the interview or after starting work.",
]));
C.push(P("Integration is needed because the value comes from combining these sources: structured accommodation data from employers and candidates, registry data about the employer, open geographic data about the location, and post-hire feedback from previous hires. OpenDoor brings them together behind a single gateway so that each decision a PWD makes is informed by all of them."));

C.push(H2("1.2 SDG Alignment"));
C.push(P("OpenDoor is aligned with **SDG 8 – Decent Work and Economic Growth**, specifically **Target 8.5**: by 2030, achieve full and productive employment and decent work for all women and men, including for young people and persons with disabilities, and equal pay for work of equal value. The connection is direct:"));
C.push(...bullets([
  "**Access to employment.** Accommodation-based matching lets PWDs find openings they can actually take, reducing the number of applications that fail because of an unmet accommodation (Target 8.5, \"persons with disabilities\").",
  "**Decent work.** The post-hire trust score makes delivered accommodations – a component of decent, non-discriminatory working conditions under RA 7277 – visible and measurable for each employer.",
  "**Inclusive economic participation.** Verified employers and transparent accommodation records encourage employers to hire inclusively and help close the gap between the PWD and general labor force participation rates.",
]));
C.push(P("The project also supports **SDG 10 (Reduced Inequalities), Target 10.2**, by promoting the economic inclusion of all irrespective of disability. Matching on accommodation needs rather than diagnosis avoids collecting unnecessary health information, in line with the Data Privacy Act of 2012 (RA 10173)."));

C.push(H2("1.3 Project Objectives"));
C.push(P("General objective: to design, integrate, deploy and evaluate OpenDoor, a service-based web application that enables PWDs to find jobs based on their accommodation needs and holds employers accountable for the accommodations they advertise. Specific objectives:"));
C.push(...bullets([
  "**Objective 1 – Integrated application.** Implement the React client, API Gateway and Core Service so that candidates, employers and administrators complete the full hiring transaction – profile with accommodation needs, \"Matches my needs\" search, application, server-enforced status workflow (Pending → Reviewed → Hired/Rejected, Withdrawn) and per-accommodation post-hire feedback with a trust score shown after three responses – entirely through REST/JSON endpoints.",
  "**Objective 2 – Service-to-service, external and legacy integration.** Integrate (a) an Accessibility Insights mashup service that combines Core Service data with the Nominatim, Overpass and PSGC REST APIs, and (b) a WSDL/SOAP 1.1 Business Registry service used for employer verification, with documented contracts, timeouts and graceful degradation.",
  "**Objective 3 – Security.** Secure every request with Sanctum bearer tokens, role middleware and Laravel Policies; secure service-to-service calls with service keys and WS-Security credentials; and keep all secrets out of the repository.",
  "**Objective 4 – Quality assurance.** Verify the APIs and integrations with an automated Postman/Newman collection (functional, negative and integration cases) and measure performance of the matching endpoint with Apache JMeter (response time, P95, throughput, error rate).",
  "**Objective 5 – Cloud deployment and DevOps.** Deploy all components to Vercel and Railway with a private service network, and automate linting, testing, building and deployment with GitHub Actions.",
  "**Objective 6 – Accessibility and usability.** Evaluate the client against WCAG 2.1 Level AA (Lighthouse, axe, NVDA) and through the System Usability Scale with at least five PWD and three employer participants (target mean SUS ≥ 68).",
]));

C.push(H2("1.4 Scope and Limitations"));
C.push(P("**Included in scope:**"));
C.push(...bullets([
  "Public area, Candidate, Employer and Admin portals in one React application (13 functional modules, M1–M13, as defined in the OpenDoor Modules and Features Specification), with display settings (text size, high contrast, reduced motion), Read aloud and Voice input.",
  "API Gateway with routing, CORS, rate limiting, request IDs, timeouts and a uniform error envelope.",
  "Core Service (Laravel 13 + MySQL 8): authentication and roles with password reset by email, candidate and company profiles, job postings with structured accommodations, search/filter/matching, saved jobs, application workflow, feedback and trust score, dashboards, in-app and email notifications, account display settings, moderation, master data.",
  "Accessibility Insights Service: Workplace Accessibility Snapshot (mashup) and PSGC location lookup with caching.",
  "Business Registry Service: SOAP 1.1 operation `VerifyBusinessRegistration` with a published WSDL, used in employer verification.",
  "Postman collection, JMeter test plan, GitHub Actions workflow, and cloud deployment.",
]));
C.push(P("**Excluded / limitations:**"));
C.push(...bullets([
  "The Business Registry Service is a **simulated** legacy system seeded with sample registrations; it does not connect to the real DTI BNRS or SEC databases, which offer no public SOAP or REST API. An administrator always makes the final verification decision.",
  "Accessibility Snapshot data depends on OpenStreetMap volunteers tagging places with `wheelchair=yes`; coverage in some Philippine areas is incomplete, so the snapshot is informational only and never used for ranking.",
  "Public Nominatim and Overpass instances have usage limits (Nominatim: at most one request per second, identifying User-Agent required), so results are cached and requests are throttled.",
  "All 13 modules were delivered, including the \"Could have\" saved jobs (M12) and display settings and email notifications (M13). Emails are sent through a mail provider chosen at deployment; during development they are written to the Core Service log. No mobile app, payments, or video interviews are included.",
  "Read aloud and Voice input use the browser's own speech features (Web Speech API). Voice input works only in browsers that offer a speech service (Chrome, Edge) and is hidden elsewhere; Chrome and Edge send the recorded audio to their vendor's speech service, so a one-time notice is shown before first use and it is never switched on by default.",
  "Free-tier/hobby cloud plans may sleep when idle and are not sized for production traffic.",
]));

C.push(H2("1.5 Intended Users / Stakeholders"));
C.push(...table(["Stakeholder", "Type", "Role in the System"], [
  ["PWD Job Seeker (Candidate)", "Primary user", "Registers with data privacy consent; records accommodation needs; browses in \"Matches my needs\" mode; views the Accessibility Snapshot and trust score; applies, withdraws or confirms hire; rates each accommodation 30 days after hire; reports misleading postings."],
  ["Employer / HR Officer", "Primary user", "Registers a company with its DTI/SEC registration number; posts jobs with structured accommodations and interview format; reviews applicants and records decisions; views its trust score and per-accommodation breakdown."],
  ["Platform Administrator", "Administrator", "Runs registry checks and verifies employers; approves or removes postings; reviews reports and flagged feedback; suspends accounts; maintains categories and accommodation types; monitors the dashboard."],
  ["Business Registry Service (simulated DTI/SEC)", "Legacy system (SOAP)", "Returns registration status and registered business name for a registration number."],
  ["OpenStreetMap Nominatim and Overpass API", "External systems (REST)", "Geocode job addresses; return wheelchair-accessible places near the workplace."],
  ["PSGC API", "External system (REST)", "Provides official Philippine region, province and city/municipality codes for consistent locations."],
  ["PESO / PDAO offices, PWD organizations", "Secondary stakeholders", "Refer job seekers, help recruit research and usability-test participants, and may use the platform to support placements."],
], [2500, 1800, 5780]));

// ---------- 2 AS-IS ----------
C.push(H1("2. AS-IS Analysis"));
C.push(H2("2.1 Current Process / Existing Systems"));
C.push(P("Today a PWD looking for work moves between several unconnected systems and manual steps:"));
C.push(...numbered([
  "The job seeker searches general job boards (PhilJobNet, JobStreet) and PWD-focused boards (PWD-E, Access Careers) one by one, creating and re-entering a profile on each. None of them stores accommodation needs as structured data.",
  "Employers post openings as free text. Accommodation details, if present, are buried in the description, so the job seeker cannot filter by them and must ask the employer through social media, email or phone.",
  "To judge the commute and surroundings (accessible entrance, nearby accessible transport stops, toilets, parking), the job seeker looks up the address separately on an online map.",
  "PESO/PDAO officers record PWD registrants on paper forms or spreadsheets and, when they endorse employers, check legitimacy manually on the DTI BNRS or SEC registry websites.",
  "After hire, nothing records whether the promised accommodations were delivered. Experiences spread only by word of mouth, so the next applicant has no reliable evidence.",
]));
C.push(H2("2.2 AS-IS Diagram"));
C.push(...fig("fig1_as_is.png", 2200, 1240, "AS-IS process: actors, unconnected systems, manual data stores and information flows"));
C.push(H2("2.3 Identified Integration Problems"));
C.push(...bullets([
  "**Unstructured, siloed accommodation data.** Accommodations exist only as free text on separate boards with no shared vocabulary or data exchange, so they cannot be matched against a candidate's needs and profiles must be re-entered (duplicate data entry, no single source of truth).",
  "**No link to authoritative business registry data.** Employer verification depends on a person manually searching registry websites; the result is not stored with the employer record or reflected on postings.",
  "**Location accessibility lives in a separate system.** Geographic and accessibility data (OpenStreetMap) is never combined with job postings, so every job seeker repeats the same manual lookup and locations are written inconsistently (no standard PSGC codes).",
  "**No post-hire feedback loop.** No system captures delivered-versus-advertised accommodations, so there is no data to build employer accountability or to warn future applicants.",
]));

// ---------- 3 TO-BE ----------
C.push(H1("3. TO-BE Solution and Architecture"));
C.push(H2("3.1 Proposed Application"));
C.push(P("OpenDoor is a responsive **web application** (React single-page application) with one public area and three role-based portals – Candidate, Employer and Admin – served through one API Gateway. After login, the client reads the user's role and opens the matching portal. The main business transaction it supports is **accommodation-aware hiring with post-hire verification**:"));
C.push(...numbered([
  "**Onboard** – a candidate registers with consent and selects accommodation needs from a shared list; an employer registers a company and is verified by an administrator against the Business Registry Service (SOAP).",
  "**Post and match** – the employer posts a job with structured accommodations; after approval, the Core Service ranks open postings by the number of the candidate's needs they meet.",
  "**Inform** – the job details page combines the posting, the employer's trust score and a Workplace Accessibility Snapshot built by the Insights Service from Nominatim, Overpass and PSGC data.",
  "**Apply and decide** – the candidate applies (optionally requesting an interview accommodation); the employer moves the application through the server-enforced workflow.",
  "**Verify after hire** – 30 days after hire, the candidate rates each advertised accommodation; the Core Service recomputes the employer's trust score and publishes it after three responses.",
]));
C.push(H2("3.2 Final Architecture"));
C.push(...fig("fig2_architecture.png", 2200, 1440, "OpenDoor final architecture: client, gateway, services, databases, external REST APIs and legacy SOAP component"));
C.push(P("The React client (Vercel) sends every request over HTTPS to the API Gateway, the only public component on Railway. The gateway routes `/api/insights/*` to the Accessibility Insights Service and all other `/api/*` paths to the Core Service. The Core Service owns the `opendoor_core` MySQL database and calls the Business Registry Service over SOAP/XML. The Insights Service calls the Core Service's internal REST endpoints for posting data, calls the three external REST APIs, and stores normalized results in its own `insights_cache` database. Each service owns its data; no service reads another service's database."));
C.push(H2("3.3 Architectural Decisions"));
C.push(...table(["Decision", "Choice", "Rationale"], [
  ["Architecture style", "API Gateway + a small number of services (service-based architecture), not a single monolith and not fine-grained microservices", "Integration concerns (external APIs, legacy SOAP) are isolated in their own services so that their failures and rate limits cannot break core hiring features. The hiring domain (users, postings, applications, feedback) stays in one Core Service because it is strongly transactional – for example, feedback must check the application status and update the trust score atomically. This keeps the system realistic for a student team."],
  ["Single entry point", "API Gateway (Node.js 22 + Express + http-proxy-middleware)", "One public URL for the client; central CORS, rate limiting, request IDs, timeouts and error format; the internal services stay on a private network. Express is lightweight and well suited to proxying."],
  ["Core Service", "Laravel 13, Sanctum, Eloquent, MySQL 8", "Already the team's IPT stack. Sanctum issues API tokens for an SPA on a different domain; Policies, Form Requests and backed enums give clean authorization, validation and the status state machine."],
  ["Service boundaries", "Core (hiring domain) · Insights (geographic mashup) · Business Registry (legacy)", "Boundaries follow data ownership and failure isolation: each service owns one data store and one integration concern."],
  ["Synchronous protocol", "REST/JSON over HTTPS for client, gateway and service-to-service calls", "Simple, widely supported, easy to test with Postman and JMeter."],
  ["Legacy protocol", "SOAP 1.1 with WSDL and WS-Security UsernameToken", "Represents how government and enterprise registries commonly expose services; demonstrates XML contracts, schema-typed messages and SOAP faults. Implemented with PHP's built-in SoapServer/SoapClient."],
  ["External data", "Nominatim, Overpass API, PSGC API", "Free, open, no paid keys; directly relevant to PWDs (wheelchair tagging) and to Philippine location data. Responses are cached to respect usage policies."],
  ["Resilience", "Per-call timeouts, caching, partial (degraded) responses", "The snapshot is optional information; hiring must keep working if an external API or the registry is down."],
  ["Deployment", "Vercel (client) + Railway (gateway, services, MySQL) with private networking", "Railway runs Docker services and managed MySQL in one project and supports internal hostnames (`*.railway.internal`); Vercel is optimized for static SPAs."],
], [1900, 2900, 5280]));
C.push(H2("3.4 Component / Service Inventory"));
C.push(...table(["Component / Service", "Responsibility", "Technology", "Port / URL", "Depends On"], [
  ["React SPA (Client)", "Public area and Candidate, Employer and Admin portals; accessible UI with display settings, Read aloud and Voice input; calls the gateway only", "React 19, Vite, React Router 7, Axios, AuthContext, Lucide icons, self-hosted Lexend and Atkinson Hyperlegible fonts, Web Speech API", "Vercel: [[https://opendoor.vercel.app]] (dev :5173)", "API Gateway"],
  ["API Gateway", "Single entry point; routing; CORS; rate limiting; X-Request-ID; timeouts; uniform error envelope; health check", "Node.js 22, Express, http-proxy-middleware, express-rate-limit", "Public: [[https://opendoor-gateway.up.railway.app]] (dev :8080)", "Core Service, Insights Service"],
  ["Core Service", "Auth and roles, password reset, profiles, postings, matching, saved jobs, applications and status workflow, feedback and trust score, dashboards, in-app and email notifications, moderation, master data; scheduled jobs (close expired postings, rating reminders, queued reset emails)", "PHP 8.4, Laravel 13, Sanctum, Eloquent; FrankenPHP in the container", "core-api.railway.internal:8001 (dev :8001)", "MySQL opendoor_core, Business Registry Service, email provider"],
  ["Accessibility Insights Service", "Workplace Accessibility Snapshot mashup; PSGC location lookup; caching and throttling", "Node.js 22, Express, Axios, mysql2", "insights.railway.internal:8002 (dev :8002)", "Core Service (internal API), Nominatim, Overpass, PSGC, MySQL insights_cache"],
  ["Business Registry Service (legacy)", "SOAP 1.1 `VerifyBusinessRegistration`; WSDL; simulated DTI/SEC records", "PHP 8.4 SoapServer (plain PHP, FrankenPHP in the container), SQLite","registry.railway.internal:8003/soap, WSDL at /soap?wsdl (dev :8003)", "registry.db"],
  ["MySQL – opendoor_core", "Users, profiles, employers, postings, accommodations, applications, feedback, notifications, reports", "MySQL 8 (Railway managed)", "mysql.railway.internal:3306", "–"],
  ["MySQL – insights_cache", "Geocoding results, Overpass results, PSGC lists, with expiry", "MySQL 8 (same server, separate schema and user)", "mysql.railway.internal:3306", "–"],
  ["Nominatim (external)", "Geocoding of job addresses", "REST/JSON", "https://nominatim.openstreetmap.org", "–"],
  ["Overpass API (external)", "Query OSM elements tagged `wheelchair=yes` near a point", "REST (Overpass QL) / JSON", "https://overpass-api.de/api/interpreter; second server https://overpass.private.coffee/api/interpreter", "–"],
  ["PSGC API (external)", "Philippine regions, provinces, cities/municipalities", "REST/JSON", "https://psgc.gitlab.io/api", "–"],
  ["Email provider (external)", "Delivers notification emails and password-reset links", "SMTP (provider chosen at deployment; `log` mailer in development)", "`MAIL_*` settings of the Core Service", "–"],
], [1700, 2600, 1900, 2180, 1700], { size: 16 }));

// ---------- 4 API ----------
C.push(H1("4. API and Data Exchange Design"));
C.push(H2("4.1 REST API Endpoints"));
C.push(P("All client requests use the gateway base URL `{GATEWAY}/api`. JSON is used for all REST bodies; lists are paginated (`?page=`, 12 items per page). Protected endpoints require `Authorization: Bearer <token>`. The main endpoints are listed below; the complete reference is in Appendix A."));
C.push(...table(["Service", "Method", "Endpoint", "Purpose", "Request / Response"], [
  ["Gateway", "GET", "/api/health", "Gateway and downstream health", "→ {status, services:{core, insights}}"],
  ["Core", "POST", "/api/register", "Create candidate or employer account with consent", "{name,email,password,role,consent:true} → 201 {user, token}"],
  ["Core", "POST", "/api/login", "Log in; returns token and role", "{email,password} → 200 {token, user:{id,name,role}}"],
  ["Core", "POST", "/api/logout", "Revoke current token", "→ 204"],
  ["Core", "POST", "/api/forgot-password, /api/reset-password", "Email a password-reset link; set a new password with it", "{email} → 200 (same message for every email); {token,email,password,password_confirmation} → 200, every session signed out; bad or expired link → 422"],
  ["Core", "PUT", "/api/me/display-prefs, /api/me/email-notifications", "Account settings (M13): display settings; notification emails on or off", "{text_size:100|125|150, contrast:'normal'|'high', motion:'normal'|'reduce'} → 200; {enabled:true|false} → 200"],
  ["Core", "GET, PUT", "/api/candidate/profile", "View or update own profile", "{headline,skills[],experience,location_psgc,...} → profile"],
  ["Core", "PUT", "/api/candidate/accommodations", "Replace list of accommodation needs", "{accommodation_ids:[1,4,9]} → 200 needs[]"],
  ["Core", "POST, GET", "/api/candidate/resume, /api/resumes/{id}", "Upload PDF résumé (max 5 MB); open it from a 30-minute signed link", "multipart `resume` → 200 {resume_url}; signed link → PDF"],
  ["Core", "GET", "/api/job-postings", "Search, filter and match postings", "?q=&category=&accommodations[]=&match=1&sort=&page= → {data:[posting+match+saved], meta}"],
  ["Core", "GET", "/api/job-postings/{id}", "Posting details with match result and trust score", "→ posting (Section 4.2)"],
  ["Core", "POST", "/api/job-postings", "Create posting (draft or submit)", "{title,description,category_id,...,accommodations:[{id,note}]} → 201"],
  ["Core", "PUT, DELETE", "/api/job-postings/{id}", "Update or soft-delete own posting", "→ 200 / 204"],
  ["Core", "POST", "/api/job-postings/{id}/applications", "Apply", "{cover_note, interview_request} → 201 application"],
  ["Core", "GET", "/api/applications", "Own applications (candidate) or applicants (employer)", "?status= → {data:[application]}"],
  ["Core", "PATCH", "/api/applications/{id}/status", "Change status (server-enforced transitions)", "{status:'reviewed'|'hired'|'rejected'|'withdrawn'} → 200 (dates `reviewed_at`, `hired_at` for the timeline)"],
  ["Core", "GET", "/api/applications/{id}/feedback-form", "Accommodations to rate (those advertised at the time of hire)", "→ {opens_on, is_open, submitted, items:[{accommodation_id,name}]}"],
  ["Core", "POST", "/api/applications/{id}/feedback", "Submit per-accommodation feedback", "{items:[{accommodation_id,rating}],comments} → 201"],
  ["Core", "GET", "/api/employers/{id}/trust-score", "Score, count and breakdown (breakdown empty until published)", "→ {published, score, based_on, breakdown[]}"],
  ["Core", "GET", "/api/admin/employers, /api/admin/employers/{id}", "Verification queue; one employer with its latest registry check", "→ AdminEmployer"],
  ["Core", "PATCH", "/api/admin/employers/{id}/verify", "Run registry check, approve or reject", "{action:'check'|'approve'|'reject', reason} → 200 {registry, verified_at}"],
  ["Core", "GET, POST, PUT, DELETE", "/api/admin/categories, /api/admin/accommodations", "Manage master data", "→ category / accommodation"],
  ["Core", "GET", "/api/candidate/dashboard, /api/employer/dashboard, /api/admin/dashboard", "Role summaries (M8); counts equal the lists they link to", "→ zero-filled counts per status, matching jobs, ratings due, trust score, queues"],
  ["Core", "GET, PATCH", "/api/notifications, /api/notifications/{id}/read, /api/notifications/read-all", "In-app notices for candidates and employers (M9)", "→ {data:[{id,type,data:{message,url},read_at}], meta:{unread_count}}"],
  ["Core", "POST; GET, PATCH", "/api/job-postings/{id}/reports; /api/admin/reports/{id}", "Report a visible posting; admin dismisses or records action (M10)", "{reason} → 201; {status:'dismissed'|'actioned', note} → 200"],
  ["Core", "DELETE", "/api/admin/job-postings/{id}", "Remove a posting in any status, e.g. after a report (M4/M10)", "{reason} → 204; soft delete, applications kept; employer gets a notice with the reason"],
  ["Core", "PATCH", "/api/admin/users/{id}/suspend", "Suspend (revokes all tokens, hides an employer's postings) or reactivate (M10)", "{suspended:true|false} → 200 user; own account → 422"],
  ["Core", "GET; POST, DELETE", "/api/candidate/saved-jobs; /api/candidate/saved-jobs/{jobId}", "Bookmarks of visible postings (M12)", "→ {data:[posting+saved], meta}; POST 201 (200 if already saved); DELETE 204"],
  ["Core (internal)", "GET", "/internal/job-postings/{id}/summary", "Posting data for the Insights Service (not routed by gateway)", "X-Service-Key → {address, psgc_code, location_label, accommodations, trust_score}"],
  ["Insights", "GET", "/api/insights/job-postings/{id}", "Workplace Accessibility Snapshot (mashup)", "→ 200 snapshot (Section 4.5); 404 posting not visible; 503 Core unreachable"],
  ["Insights", "GET", "/api/insights/locations/{level}", "Normalized PSGC lists (regions, provinces, cities/municipalities)", "?parent=<10-digit PSGC code> → [{code,name,level}]; header `X-Data-Source`"],
  ["Registry (SOAP)", "POST", "/soap  (SOAPAction: VerifyBusinessRegistration)", "Legacy registry lookup (internal only)", "SOAP envelope → SOAP response / Fault (Section 4.3)"],
], [1250, 950, 2700, 2280, 2900], { size: 16 }));

C.push(H2("4.2 JSON Representation"));
C.push(P("**Search with matching** – `GET /api/job-postings?match=1&q=encoder&page=1` (candidate token). The `match` object is computed by the Core Service from the candidate's needs; it appears only for logged-in candidates who have saved accommodation needs."));
C.push(...code(`
{
  "data": [
    {
      "id": 42,
      "title": "Data Encoder",
      "employer": { "id": 7, "company_name": "Bright Path BPO Inc.", "verified": true },
      "category": { "id": 3, "name": "Administrative" },
      "location": { "psgc_code": "1381300000", "label": "Quezon City, National Capital Region (NCR)" },
      "employment_type": "full_time",
      "work_setup": "hybrid",
      "interview_format": "online",
      "closes_at": "2026-11-30",
      "accommodations": [
        { "id": 1, "name": "Wheelchair-accessible entrance", "group": "physical_access",
          "note": "Ramp at main entrance; restroom on 2nd floor via elevator" },
        { "id": 9, "name": "Flexible hours", "group": "work_arrangement", "note": null }
      ],
      "match": { "met": 4, "total": 5, "missing": [ { "id": 6, "name": "Sign language interpreter" } ] },
      "saved": false,
      "trust_score": { "published": true, "score": 86, "based_on": 5 }
    }
  ],
  "meta": { "current_page": 1, "per_page": 12, "total": 12, "match_mode": true }
}`));
C.push(P("Important fields: `match.met`/`match.total` drive the \"Meets 4 of 5 of your needs\" badge and `missing` names the unmet accommodation; `saved` (logged-in candidates only) drives the Save button on each result; `trust_score.published` is false (and `score` null) until three feedback responses exist; `location.psgc_code` is the official 10-digit PSGC code chosen in the location picker (the label is stored with it) and is used by the Insights Service."));
C.push(P("**Apply** – `POST /api/job-postings/42/applications`"));
C.push(...code(`
Request:  { "cover_note": "I have 3 years of encoding experience.",
            "interview_request": "Please provide a captioned online interview." }

Response 201:
{ "id": 318, "job_posting_id": 42, "status": "pending",
  "created_at": "2026-10-02T09:15:04+08:00" }`));
C.push(P("**Submit feedback** – `POST /api/applications/318/feedback` (only when status is `hired`, from calendar day 30 after the hire date in Asia/Manila time – e.g. hired on 1 October, feedback opens on 31 October; one per application). The items are the accommodations the posting advertised when the application became hired – the Core Service records them at hire in `application_accommodation`, so later edits to the posting do not change what is rated – and every item must be rated once. Ratings map to Delivered = 1, Partially = 0.5, Not delivered = 0. The candidate's own application view adds `feedback_submitted`; employers never see whether or how a candidate rated."));
C.push(...code(`
Request:  { "items": [ { "accommodation_id": 1, "rating": "delivered" },
                       { "accommodation_id": 9, "rating": "partial" } ],
            "comments": "Ramp is available; schedule changes need two weeks' notice." }

Response 201: { "id": 77, "application_id": 318, "items_rated": 2 }`));
C.push(P("**Error envelope** – every service returns errors in one format, so the client can show a message and the team can trace the request across services with `request_id`. Validation errors (422) keep Laravel's `errors` object so the React forms can show messages beside each field."));
C.push(...code(`
HTTP/1.1 409 Conflict
{ "error": { "code": "ALREADY_APPLIED",
             "message": "You have already applied to this posting.",
             "request_id": "c7f1e2a4-5b0d-4f7e-9c41-0d8a1f2b3c4d" } }

HTTP/1.1 422 Unprocessable Content
{ "message": "The given data was invalid.",
  "error": { "code": "VALIDATION_FAILED", "request_id": "..." },
  "errors": { "accommodations.0.id": [ "The selected accommodation is invalid." ] } }`));

C.push(H2("4.3 XML / SOAP / Legacy Interoperability"));
C.push(P("**Scenario.** Employers register with a DTI (sole proprietorship) or SEC (corporation/partnership) registration number. In the AS-IS process this is checked by hand on registry websites. OpenDoor models the registry as a legacy system that exposes only a SOAP 1.1 interface described by a WSDL. Because the real DTI BNRS and SEC systems offer no public machine interface, the **Business Registry Service is a simulation** seeded with sample records; the contract, transport, security header and faults are implemented as a real SOAP integration."));
C.push(P("**Contract (WSDL excerpt)** – published at `/soap?wsdl`, target namespace `urn:opendoor:registry:v1`, document/literal style, one operation:"));
C.push(...code(`
<definitions name="BusinessRegistry" targetNamespace="urn:opendoor:registry:v1"
    xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="urn:opendoor:registry:v1"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <types>
    <xsd:schema targetNamespace="urn:opendoor:registry:v1" elementFormDefault="qualified">
      <xsd:element name="VerifyBusinessRegistrationRequest">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="RegistrationNumber" type="xsd:string"/>
          <xsd:element name="RegistryType">          <!-- DTI | SEC -->
            <xsd:simpleType><xsd:restriction base="xsd:string">
              <xsd:enumeration value="DTI"/><xsd:enumeration value="SEC"/>
            </xsd:restriction></xsd:simpleType>
          </xsd:element>
          <xsd:element name="BusinessName" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="VerifyBusinessRegistrationResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="Found" type="xsd:boolean"/>
          <xsd:element name="Status" type="xsd:string"/>   <!-- ACTIVE | EXPIRED | CANCELLED | NOT_FOUND -->
          <xsd:element name="RegisteredName" type="xsd:string" minOccurs="0"/>
          <xsd:element name="DateRegistered" type="xsd:date" minOccurs="0"/>
          <xsd:element name="NameMatchScore" type="xsd:decimal"/>
          <xsd:element name="CheckedAt" type="xsd:dateTime"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <!-- message, portType, binding (soap:binding style="document"), service elided; see Appendix B -->
</definitions>`));
C.push(P("**Representative request** (sent by the Core Service with PHP `SoapClient`):"));
C.push(...code(`
POST /soap HTTP/1.1
Host: registry.railway.internal:8003
Content-Type: text/xml; charset=utf-8
SOAPAction: "urn:opendoor:registry:v1#VerifyBusinessRegistration"

<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:reg="urn:opendoor:registry:v1"
                  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>opendoor-core</wsse:Username>
        <wsse:Password>\${REGISTRY_SOAP_PASSWORD}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <reg:VerifyBusinessRegistrationRequest>
      <reg:RegistrationNumber>CS201800777</reg:RegistrationNumber>
      <reg:RegistryType>SEC</reg:RegistryType>
      <reg:BusinessName>Bright Path BPO Inc.</reg:BusinessName>
    </reg:VerifyBusinessRegistrationRequest>
  </soapenv:Body>
</soapenv:Envelope>`));
C.push(P("**Representative response and fault:**"));
C.push(...code(`
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:reg="urn:opendoor:registry:v1">
  <soapenv:Body>
    <reg:VerifyBusinessRegistrationResponse>
      <reg:Found>true</reg:Found>
      <reg:Status>ACTIVE</reg:Status>
      <reg:RegisteredName>BRIGHT PATH BPO INC.</reg:RegisteredName>
      <reg:DateRegistered>2019-03-14</reg:DateRegistered>
      <reg:NameMatchScore>0.96</reg:NameMatchScore>
      <reg:CheckedAt>2026-10-02T10:02:11+08:00</reg:CheckedAt>
    </reg:VerifyBusinessRegistrationResponse>
  </soapenv:Body>
</soapenv:Envelope>

<!-- Fault example: missing/invalid credentials -->
<soapenv:Fault>
  <faultcode>soapenv:Client.Authentication</faultcode>
  <faultstring>Invalid WS-Security credentials</faultstring>
</soapenv:Fault>

<!-- Fault example: invalid input (empty number, unknown RegistryType, bad format) -->
<soapenv:Fault>
  <faultcode>soapenv:Client.Validation</faultcode>
  <faultstring>RegistrationNumber is required and must be 5-20 letters or digits</faultstring>
</soapenv:Fault>`));
C.push(...table(["Fault code", "Raised when", "Core Service mapping"], [
  ["`soapenv:Client.Authentication`", "WS-Security header missing or wrong username/password", "502 `REGISTRY_AUTH_FAILED` (configuration problem, logged)"],
  ["`soapenv:Client.Validation`", "Request fails validation: `RegistrationNumber` not 5–20 letters or digits (hyphens and spaces are ignored, so `CS-2018-00777` matches), `RegistryType` not DTI/SEC, missing `BusinessName`", "422 `REGISTRY_INVALID_REQUEST`"],
  ["`soapenv:Server`", "Unexpected registry error (e.g., database unavailable)", "502 `REGISTRY_UNAVAILABLE`"],
], [2600, 4280, 3200], { size: 16 }));
C.push(P("**How the contract is used.** The Core Service sends the employer's `business_reg_no`, `registry_type` and `company_name`. The response is mapped to JSON and stored in a `registry_checks` record (the number and registry type that were checked, status, registered name, match score, the XML answer, the administrator and the time; the request itself is never stored because it carries the password). `NameMatchScore` is a normalized similarity (0–1) between the submitted and registered names (upper case, punctuation and trailing INC./CORP./CO. removed, then PHP `similar_text`); for `NOT_FOUND` the API returns `name_match: null`. A check is shown only while the employer's number and type are unchanged. The administrator sees the result and decides; a `NOT_FOUND`, `EXPIRED` or `CANCELLED` status or a score below 0.80 is highlighted. Client faults (bad input, bad credentials) become HTTP 422/502 with codes `REGISTRY_INVALID_REQUEST`/`REGISTRY_AUTH_FAILED`; server faults, connection errors or a 5-second timeout become HTTP 502 `REGISTRY_UNAVAILABLE` and are stored as an `ERROR` check, and the employer stays in the manual review queue."));

C.push(H2("4.4 External REST API"));
C.push(...table(["Provider", "Purpose", "Authentication", "Data Used", "Failure / Fallback Handling"], [
  ["OpenStreetMap Nominatim (`/search`)", "Geocode a job posting's address to latitude/longitude", "None; identifying `User-Agent` and contact email required by usage policy", "`lat`, `lon`, `display_name`, `importance`", "Max 1 request/second (throttled queue; a request that would wait more than 2 s is not sent); results cached 30 days; street address not found → the city itself is searched (`precision: \"city\"`); on error or timeout (5 s) use an expired cache entry (`stale`), else a bundled city centre for the PSGC code (`precision: \"city\"`) and mark the source `unavailable`; Nominatim is never called without the contact email"],
  ["Overpass API (`/api/interpreter`)", "Find OSM elements tagged `wheelchair=yes|limited` within 500 m (transit stops, toilets, parking, entrances)", "None (fair-use limits)", "`elements[].tags` (`amenity`, `public_transport`, `highway`, `wheelchair`, `name`), `lat`, `lon`", "Cached 24 h (point rounded to 4 decimals + radius). Public servers are often overloaded, so the client waits up to 25 s per server (the query itself keeps `[timeout:8]`) and asks a second, independent server (`OVERPASS_FALLBACK_URL`) when the first fails or has not answered after 5 s – the first good answer wins and the other request is cancelled. 429/504 pages, a `runtime error` remark or a timeout count as failures and are never cached; then the last cached result is returned as `stale`, else `nearby_accessible` is null and the source `unavailable`. A place that failed or was served stale is fetched again in the background after 90 s, 5 min and 15 min until the cache is filled (at most 50 places at a time)"],
  ["PSGC API (psgc.gitlab.io/api)", "Official Philippine regions, provinces, cities/municipalities for location pickers and normalization", "None", "`psgc10DigitCode`, `code`, `name`, `regionName`, `isCity`", "OpenDoor uses the official 10-digit codes; the API's own 9-digit code is kept only for follow-up requests. Lists cached 7 days; if the API is unreachable: expired cache entry (`stale`), then a bundled copy of all regions, provinces and their cities/municipalities (`fallback`), else 503 `SERVICE_UNAVAILABLE`"],
], [1800, 2000, 1700, 2100, 2480], { size: 16 }));

C.push(H2("4.5 Mashup / Data Transformation"));
C.push(P("The **Workplace Accessibility Snapshot** (`GET /api/insights/job-postings/{id}`) combines four sources into one result shown on the job details page. Only the Core Service is required; the whole snapshot must be built within 12 seconds (the gateway allows 15):"));
C.push(...numbered([
  "**Extract – Core Service.** The Insights Service calls `GET /internal/job-postings/{id}/summary` (service key) to obtain the posting's street address, PSGC code and label, advertised accommodations (grouped) and the employer's trust score with its breakdown. Posting data is never cached by the Insights Service. Core 404 (posting missing, not open or not approved) → snapshot 404; any other Core failure (down, timeout, rejected key, unexpected answer) → 503 `SERVICE_UNAVAILABLE`.",
  "**Extract – PSGC.** Locations are chosen from PSGC lists in the location picker instead of typed, so \"QC\", \"Quezon City\" and \"Q.C.\" all become code `1381300000`. The Insights Service resolves the code to the official `City, Province, Region` names (NCR has no province; highly urbanized cities such as Cebu City are searched across the region's provinces). If PSGC is unavailable, the label stored by the Core Service is used.",
  "**Extract – Nominatim.** The query `street address, City, Province` is geocoded to coordinates (`precision: \"street\"`). If the street is not found, the city itself is searched (e.g. \"Makati, Metro Manila\"; for PSGC's \"City of X\" also \"X City, Province\" and \"X City\"), accepting only a city, town or municipality – or a result whose address names the city – so that provinces or same-name places elsewhere are not used (`precision: \"city\"`). If nothing is found or Nominatim fails, a bundled city centre for the PSGC code is used.",
  "**Extract – Overpass.** An Overpass QL query (Appendix B) returns OSM elements within 500 m tagged `wheelchair=yes` or `limited`. Without coordinates, or when Overpass fails and nothing is cached, `nearby_accessible` is `null` (empty lists mean that nothing was found).",
  "**Transform.** OSM tags are mapped to four PWD-relevant categories (Accessible transit stops, Accessible toilets, Accessible parking, Other accessible places); distances from the exact workplace point are computed with the haversine formula; duplicates are removed; `limited` is reported separately from `yes`; the nearest three items per category are kept.",
  "**Combine.** The result merges the employer's own claims (advertised accommodations by group), the community verification (trust score and per-accommodation breakdown; `null` until the score is published) and the independent map data, plus a `sources` object that tells the client which parts are live (`ok`), cached, stale or unavailable. A source that has not answered when the 12-second budget is used up is reported `unavailable` and no further source is started; its request still completes and fills the cache for the next visitor.",
]));
C.push(P("**OSM tag → category mapping** used in the Transform step (rules are checked top to bottom; the first match wins; only elements tagged `wheelchair=yes` or `wheelchair=limited` are kept):"));
C.push(...table(["Snapshot category", "OSM tags that qualify", "Shown to the user as"], [
  ["`transit_stops`", "`public_transport=*`, `highway=bus_stop`, `railway=station|halt|tram_stop`, `amenity=bus_station`", "Accessible transit stops (e.g., \"Quezon Ave. MRT Station – 220 m away, wheelchair accessible\")"],
  ["`toilets`", "`amenity=toilets`, or any element with `toilets:wheelchair=yes`", "Accessible toilets"],
  ["`parking`", "`amenity=parking` (with `capacity:disabled` when present)", "Accessible parking"],
  ["`other`", "Any other **named** element with a `wheelchair` tag (shops, malls, offices); unnamed ones are dropped", "Other accessible places"],
], [1900, 4880, 3300], { size: 16 }));
C.push(P("Each item keeps `name` (or null), `wheelchair` (`yes` / `limited`) and `distance_m` (haversine distance in whole metres). Elements are de-duplicated by OSM id; ways use their `center` coordinates, and a way whose centre lies beyond 500 m is dropped. Unnamed transit stops, toilets and parking are kept, but unnamed `other` elements are dropped: in live data these were mostly entrances and kerbs that would only read as \"Unnamed place\"."));
C.push(...code(`
{
  "job_posting_id": 42,
  "location": { "psgc_code": "1381300000", "label": "Quezon City, National Capital Region (NCR)",
                "lat": 14.6507, "lon": 121.0494, "precision": "street" },
  "employer_claims": { "physical_access": [ "Wheelchair-accessible entrance",
                                           "Elevator or ground-floor workspace" ] },
  "community_verification": { "trust_score": 86, "based_on": 5,
      "breakdown": [ { "accommodation_id": 1, "name": "Wheelchair-accessible entrance",
                       "delivered": 5, "partial": 0, "not_delivered": 0, "of": 5 } ] },
  "nearby_accessible": {
    "radius_m": 500,
    "transit_stops":  [ { "name": "Quezon Ave. MRT Station", "wheelchair": "yes", "distance_m": 220 } ],
    "toilets":        [ { "name": null, "wheelchair": "yes", "distance_m": 140 } ],
    "parking":        [],
    "other":          [ { "name": "Example Mall", "wheelchair": "limited", "distance_m": 410 } ]
  },
  "sources": { "core": "ok", "psgc": "cached", "nominatim": "ok", "overpass": "ok" },
  "disclaimer": "Map data from OpenStreetMap contributors (ODbL); coverage may be incomplete.",
  "generated_at": "2026-10-02T10:05:40+08:00"
}`));
C.push(P("A second transformation happens inside the Core Service: the **matching engine** joins `candidate_accommodation` and `job_posting_accommodation` (Eloquent `withCount`) to compute `match.met`, orders full matches first and then partial matches by count (ties follow the chosen sort: newest or closing soon), and applies keyword, category and extra accommodation filters on top (a posting must offer every selected accommodation). The **trust score** transformation converts ratings to values (Delivered = 1, Partially = 0.5, Not delivered = 0) and computes Σ item ratings ÷ number of rated items × 100, rounded to a whole percentage (e.g. 86%)."));

// ---------- 5 Integration flow ----------
C.push(H1("5. Integration Flow"));
C.push(H2("5.1 Core Transaction Sequence"));
C.push(...fig("fig3_sequence_match_apply.png", 2200, 1520, "Sequence – a candidate opens a matched job, receives the Accessibility Snapshot and applies"));
C.push(...fig("fig4_sequence_verify.png", 2200, 1240, "Sequence – an administrator verifies an employer through the legacy SOAP Business Registry"));
C.push(H2("5.2 Service-to-Service Integrations"));
C.push(...table(["Source", "Destination", "Trigger / Endpoint", "Data Exchanged", "Expected Result"], [
  ["React SPA", "API Gateway", "Any `/api/*` call (HTTPS)", "JSON body, Bearer token", "Request routed with `X-Request-ID`; uniform error format on failure"],
  ["API Gateway", "Core Service", "`/api/*` (except insights) via `http://core-api.railway.internal:8001`", "Original request + `X-Request-ID`, `X-Forwarded-For`", "Core response passed back unchanged; 504 `UPSTREAM_TIMEOUT` after 10 s"],
  ["API Gateway", "Insights Service", "`/api/insights/*` via `http://insights.railway.internal:8002`", "Original request + `X-Request-ID`", "Snapshot or location list; 504 after 15 s"],
  ["Insights Service", "Core Service", "`GET /internal/job-postings/{id}/summary` with `X-Service-Key`", "Address, PSGC code and label, accommodations, trust score with breakdown", "200 summary (never cached); 404 if posting is not open/approved → snapshot 404; any other failure → snapshot 503"],
  ["Core Service", "Business Registry (legacy)", "SOAP `VerifyBusinessRegistration` on `PATCH /api/admin/employers/{id}/verify` (`action=check`)", "Registration number, registry type, business name; WS-Security UsernameToken", "Registry status and name-match score stored in `registry_checks`"],
  ["Insights Service", "Nominatim (external)", "`GET /search?q=&countrycodes=ph&format=jsonv2&limit=1` (city searches `limit=5`); `User-Agent` with contact email", "Street address and PSGC place names → lat/lon", "Coordinates cached 30 days (key: SHA-256 of the normalized query)"],
  ["Insights Service", "Overpass (external)", "`POST /api/interpreter` (Overpass QL, `around:500`) on the main server; the second server after 5 s or a failure", "Coordinates → OSM elements with `wheelchair` tag", "Nearby accessible places cached 24 h; a failed place is retried in the background"],
  ["Insights Service", "PSGC API (external)", "`GET /regions`, `/regions/{code}/provinces`, `/regions/{code}/cities-municipalities` (NCR), `/provinces/{code}/cities-municipalities`", "PSGC codes and names", "Normalized location lists (10-digit codes, sorted by name) cached 7 days"],
  ["Core Service", "Core Service (event)", "Application status change; admin decision on an employer's verification or a posting's review; feedback saved/hidden (observer)", "Application, decision and reason, feedback items", "In-app notification created (`application_received`, `application_status_changed`, `employer_verification`, `posting_review`); employer trust score and feedback count recalculated"],
  ["Core scheduler", "Core Service (commands)", "Daily 00:05 `postings:close-expired`; daily 08:00 `feedback:remind`; every minute the database queue worker", "Postings past their closing date; hired applications whose rating opens today; queued reset-link jobs", "Postings closed; `feedback_reminder` notice to the hired candidate (once); password-reset emails sent within about a minute"],
  ["Core Service", "Email provider (external)", "Every in-app notice of a user whose emails are on (sent after the HTTP response); `POST /api/forgot-password` (queued job)", "Subject, the notice text and a link to the page in OpenDoor – never disability or accommodation-need details; the reset link", "Email delivered; a mail failure is logged and never fails the user's action; suspended accounts get no email"],
], [1500, 1600, 2600, 2180, 2200], { size: 16 }));
C.push(H2("5.3 Error Handling and Status Propagation"));
C.push(P("Every service returns the error envelope shown in Section 4.2. The gateway creates an `X-Request-ID` (UUID) if the client did not send one, forwards it to every downstream call, and logs it, so one request can be traced through all services. Downstream status codes are propagated unchanged to the client; the gateway only generates its own errors when a dependency cannot be reached."));
C.push(...table(["HTTP", "Application Error Code", "Raised by", "When / Behavior"], [
  ["400", "BAD_REQUEST", "Core", "A request the framework rejects as malformed. A malformed JSON body is read as empty and answered with 422 `VALIDATION_FAILED` (never a stack trace)"],
  ["401", "UNAUTHENTICATED", "Core", "Missing, invalid or revoked Sanctum token (also every token of a suspended account); the client logs the user out"],
  ["403", "FORBIDDEN / ACCOUNT_SUSPENDED", "Core", "Wrong role or Policy denies (e.g., editing another employer's posting, reading another candidate's application); login to a suspended account"],
  ["404", "NOT_FOUND", "Core, Insights", "Unknown ID; a posting that is not open and approved, or whose employer is suspended (also when saving, applying or reporting); unknown PSGC region/province"],
  ["409", "ALREADY_APPLIED / FEEDBACK_EXISTS", "Core", "Duplicate application or second feedback for the same application"],
  ["422", "VALIDATION_FAILED", "Core, Insights", "Form Request validation fails, or a location list `parent` that is not a 10-digit PSGC code; also business checks reported per field: a second open report on the same posting (`errors.reason`), an administrator suspending their own account (`errors.suspended`); field errors returned in `errors`"],
  ["422", "INVALID_STATUS_TRANSITION", "Core", "Transition not allowed by the ApplicationStatus enum (e.g., Rejected → Hired, Pending → Hired)"],
  ["422", "POSTING_CLOSED / FEEDBACK_NOT_OPEN", "Core", "Applying to a closed posting; feedback before calendar day 30 after the hire date (Asia/Manila)"],
  ["422", "REGISTRY_INVALID_REQUEST", "Core", "Registry returned `Client.Validation` (e.g., malformed registration number); the employer is asked to correct it"],
  ["429", "RATE_LIMITED", "Gateway, Core", "Over 120 requests/min per IP at the gateway, or over 5 login or password-reset requests/min; `Retry-After` header sent"],
  ["500", "SERVER_ERROR", "Core", "Unexpected server error; generic message only (no stack trace), details logged with the `request_id`"],
  ["502", "REGISTRY_UNAVAILABLE / REGISTRY_AUTH_FAILED", "Core", "`Server` / `Client.Authentication` fault, connection failure or 5-second timeout; employer remains in the manual review queue"],
  ["502", "UPSTREAM_ERROR", "Gateway", "Downstream service refused the connection or returned an invalid response"],
  ["503", "SERVICE_UNAVAILABLE", "Gateway, Insights", "Gateway: target service down (e.g., sleeping free-tier instance). Insights: Core Service unreachable for a snapshot, or a PSGC list neither cached nor bundled"],
  ["504", "UPSTREAM_TIMEOUT", "Gateway", "Core > 10 s, Insights > 15 s"],
], [800, 3000, 1500, 4780], { size: 16 }));
C.push(P("**Graceful degradation.** External and legacy integrations never block the core hiring transaction. The Insights Service uses per-source timeouts (Core 3 s, PSGC 5 s, Nominatim 5 s, Overpass 25 s per server with the second server asked after 5 s) within a 12-second budget for the whole snapshot – a later Overpass answer still fills the cache – returns HTTP 200 with whatever parts it could build, and reports each source as `ok`, `cached`, `stale` or `unavailable`. A source that failed is skipped for 60 seconds (cooldown), so during an outage each request waits for at most one timeout and is answered from the cache. The client explains each gap in plain language (for example \"Nearby places could not be loaded right now. Please check again later.\" or, with city-level coordinates, that distances are measured from the city centre). If the snapshot fails (503) or the Insights Service itself is down, the job details page still renders the posting, match result and trust score from the Core Service and the snapshot section shows a short warning. If the Business Registry is down, administrators can still verify manually and the check can be repeated. The gateway and the Core Service never retry a call automatically; the user or administrator repeats the action. The only automatic retries are in the Insights Service for Overpass (second server, background refresh of a failed place), because they only refresh cached map data and change nothing in the hiring records. Notification emails are sent after the response, so a slow or failing mail server never delays or breaks the action."));

// ---------- 6 Security ----------
C.push(H1("6. Security Design"));
C.push(H2("6.1 Authentication"));
C.push(...bullets([
  "**Users** log in with email and password through `POST /api/login`. Passwords are hashed with bcrypt. The Core Service issues a **Laravel Sanctum personal access token**, which the React client sends as `Authorization: Bearer <token>` on each request through the gateway. Logout revokes the token on the server. Suspended accounts cannot log in and all their tokens are revoked at once; while an employer is suspended its postings are hidden from candidates and guests (nothing is deleted, so reactivation restores them).",
  "**Forgotten passwords:** `POST /api/forgot-password` gives the same answer for every email and only queues a job, so neither the message nor the response time reveals whether an account exists (an OpenDoor account hints at a disability – RA 10173). The job emails a link to active accounts only; the link is valid for 60 minutes and can be used once, the reset signs the user out on every device, and both endpoints allow 5 requests per minute. The reset email is a security message, so it is sent even when notification emails are turned off.",
  "**Administrators** are never self-registered; they are created by the seeder or by another administrator.",
  "**Gateway → services:** the gateway forwards the bearer token unchanged; the Core Service validates it (the gateway does not trust or decode it).",
  "**Insights → Core (service-to-service):** internal endpoints under `/internal/*` are not routed by the gateway and require an `X-Service-Key` header whose value is a shared secret held only by the two services; requests without it receive 401.",
  "**Core → Business Registry (legacy):** a WS-Security `UsernameToken` in the SOAP header identifies the Core Service; the registry rejects missing or wrong credentials with a SOAP fault.",
]));
C.push(H2("6.2 Authorization"));
C.push(P("Authorization is enforced on the server in three layers: (1) `auth:sanctum` middleware requires a valid token; (2) a **role middleware** restricts route groups to `candidate`, `employer` or `admin`; and (3) **Laravel Policies** (`JobPostingPolicy`; `ApplicationPolicy` for viewing, status changes and feedback) check ownership of the specific record – for example, an employer can update only its own postings and can see a candidate's accommodation needs only through an application to its own posting, and only the hired candidate can submit feedback. API Resources control which fields each role receives (feedback authors are never exposed to employers). The React `ProtectedRoute` component only improves navigation; the server is the real protection. The full permission matrix is reproduced in Appendix A."));
C.push(P("**OAuth 2.0** is not used in this version: all users authenticate directly with OpenDoor, and the external APIs used require no delegated access. A delegated-authorization scenario (e.g., \"Sign in with Google\" or letting a candidate import a résumé from a third-party service) is listed as a future improvement."));
C.push(H2("6.3 Secret and Credential Management"));
C.push(...bullets([
  "All secrets are environment variables: `APP_KEY`, `DB_*`, `SERVICE_KEY_INSIGHTS`, `REGISTRY_SOAP_USER/PASSWORD`, `MAIL_*` (mail provider credentials), `NOMINATIM_CONTACT_EMAIL`, `DEMO_PASSWORD`; settings such as `CORS_ALLOWED_ORIGIN` and `VITE_API_URL` use the same mechanism.",
  "Each component has a committed `.env.example` with placeholder values only; real `.env` files are listed in `.gitignore` and are never committed.",
  "Production values are stored in **Railway service variables** and **Vercel environment variables**. The CI integration job generates throwaway secrets (database passwords, service key, SOAP password, demo password) at the start of every run, so no secret is stored in GitHub. The production `APP_KEY` is generated fresh and differs from development.",
  "Demo and test accounts (one per role) are created by seeders with passwords read from environment variables; they are shared with the evaluators through the submission notes, not written in the repository or this document.",
  "Secrets are never logged: the gateway redacts `Authorization` and `X-Service-Key` headers in logs, and `APP_DEBUG=false` in production.",
]));
C.push(H2("6.4 Security Considerations"));
C.push(...bullets([
  "**Input validation:** Laravel Form Requests validate every create/update (required fields, `Rule::exists` for accommodation and category IDs, `Rule::enum` for statuses, max lengths, PDF-only size-limited résumé uploads); Eloquent parameter binding prevents SQL injection; the SOAP request is validated against the WSDL schema; React escapes output by default.",
  "**Uploaded files:** company logos are public images served through the gateway; résumés are stored on Core's private disk and opened only through a temporary signed link (30 minutes, `Cache-Control: no-store`) returned to the candidate, so the PDF can be opened in a new tab without exposing the token. Links in API responses (logos, résumés, page links) always point at the gateway, never at an internal service host.",
  "**Transport/HTTPS:** Vercel and Railway public endpoints use HTTPS only; internal calls stay on Railway's private network and are not exposed to the internet.",
  "**Least privilege / access controls:** only the gateway is public; each service has its own database user limited to its own schema; role middleware and Policies enforce per-record ownership; CORS allows only the deployed frontend origin.",
  "**Abuse protection:** gateway rate limiting (120 requests/min per IP) and login and password-reset rate limiting (5 requests/min per email and IP).",
  "**Information disclosure:** errors carry only a code, a plain message and the `request_id` (no stack traces, `APP_DEBUG=false`); the gateway removes `X-Powered-By` headers from upstream responses, so clients cannot read the server stack or PHP version; an unknown origin receives no CORS headers.",
  "**Data privacy (RA 10173):** explicit consent is recorded (`consented_at`) before accommodation data is stored; disability type is optional, hidden by default and never used for matching; candidates' needs are shown to an employer only after the candidate applies; trust scores and their per-accommodation breakdown are aggregated and shown only after three responses so individual employees cannot be identified; notification emails state only what happened and link to OpenDoor – never disability or needs details – and can be turned off in Account settings; Read aloud runs entirely in the browser, and Voice input is never on by default and explains before first use that Chrome and Edge send the audio to their speech service.",
  "**Project-specific risks:** fake employers (mitigated by registry check and Verified badge), retaliation for negative feedback (anonymity and three-response threshold), false accommodation claims (report-a-posting and moderation), and dependence on third-party APIs (caching, timeouts, degraded mode).",
]));

// ---------- 7 Testing ----------
C.push(H1("7. Testing and Quality Assurance"));
C.push(H2("7.1 Functional and Integration Test Plan"));
C.push(...table(["Test ID", "Scenario", "Type", "Expected Result", "Actual Result", "Status"], [
  ["T01", "Register candidate with consent, then log in", "Functional", "201 then 200 with token and `role=candidate`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T02", "Employer creates a posting with 3 accommodations and notes", "Functional", "201; posting `status=pending_approval`, 3 accommodations stored", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T03", "Candidate with 5 needs searches with `match=1`", "Functional", "200; postings ordered by `match.met` desc; `missing` lists unmet needs", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T04", "Candidate applies to an open posting", "Functional", "201 `status=pending`; employer receives notification", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T05", "Candidate applies to the same posting twice", "Negative", "409 `ALREADY_APPLIED`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T06", "Employer changes `pending` directly to `hired`", "Negative", "422 `INVALID_STATUS_TRANSITION`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T07", "GET `/api/job-postings/999999` (invalid ID)", "Negative", "404 `NOT_FOUND` with `request_id`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T08", "Employer A updates Employer B's posting", "Negative (security)", "403 `FORBIDDEN`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T09", "Request without token to `/api/applications`", "Negative (security)", "401 `UNAUTHENTICATED`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T10", "Hired candidate submits feedback after 30 days; 3rd response for employer", "Functional", "201; trust score published with `based_on=3` and correct value", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T11", "Feedback before 30 days after hire", "Negative", "422 `FEEDBACK_NOT_OPEN`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T12", "Get Accessibility Snapshot (Gateway → Insights → Core → Nominatim/Overpass/PSGC)", "Integration", "200 within 15 s; `location` has the PSGC code, label and coordinates in the Philippines (`precision` street or city); `sources.core=ok`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T13", "Snapshot with Overpass unreachable (invalid `OVERPASS_URL` in test env)", "Integration (degradation)", "200; `sources.overpass=unavailable` and `nearby_accessible=null` (`cached`/`stale` if a cached result exists); location and employer claims present", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T14", "Admin registry check for a seeded ACTIVE SEC number", "Integration (SOAP)", "200; `registry.status=ACTIVE`; `name_match ≥ 0.80`; check stored", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T15", "Registry check with an unknown number / wrong SOAP password", "Integration (negative)", "200 `status=NOT_FOUND` / 502 `REGISTRY_AUTH_FAILED`", "[[Actual]]", "[[PASS/FAIL]]"],
  ["T16", "Call Core `/internal/job-postings/{id}/summary` without `X-Service-Key`", "Integration (security)", "401 `UNAUTHENTICATED`; the gateway does not route `/internal/*`", "[[Actual]]", "[[PASS/FAIL]]"],
], [700, 2800, 1300, 2700, 1500, 1080], { size: 16 }));
C.push(P("Each test ID is the prefix of at least one request name in the Postman collection (e.g. `T05 Applying again → 409 ALREADY_APPLIED`), so a Newman report shows the result per test. Folder 09 adds further security cases beyond the plan: a forged token, other roles and other employers denied (403), a candidate or employer reading someone else's application (403), an administrator suspending their own account (422), SQL-like search text treated as plain text, malformed JSON answered without a stack trace, no CORS headers for an unknown origin, no `X-Powered-By` header, and the suspension rule end to end (token revoked, login refused, postings hidden, restored on reactivation)."));
C.push(H2("7.2 Postman / API Test Evidence"));
C.push(P("The repository contains `tests/postman/OpenDoor.postman_collection.json` and environments `local.postman_environment.json` and `production.postman_environment.json` (variables: `baseUrl`, `candidateEmail`, `employerEmail`, `adminEmail`, passwords from secrets). The collection is organized in folders that run in order: **01 Auth**, **02 Master Data**, **03 Employer & Postings**, **04 Candidate & Matching**, **05 Applications & Status**, **06 Feedback & Trust Score**, **07 Insights Mashup**, **08 Admin & SOAP Registry**, **09 Negative & Security Cases**. Login requests save tokens to collection variables; create requests save IDs (`jobPostingId`, `applicationId`) for later requests."));
C.push(P("Assertions written in each request's Tests tab check:"));
C.push(...bullets([
  "**Status codes** – e.g., `pm.response.to.have.status(201)` for create, 409/422/403/401/404 for negative cases.",
  "**Identifiers** – returned `id` is a number and equals the saved `applicationId`; `job_posting_id` matches the request.",
  "**Business values** – `status` equals `pending` after apply; `match.met <= match.total`; results sorted by `match.met` descending; `trust_score.published` is false with fewer than three responses and true with `based_on >= 3`.",
  "**Application errors** – `error.code` equals the expected code (`ALREADY_APPLIED`, `INVALID_STATUS_TRANSITION`, …) and `error.request_id` exists.",
  "**Schema and timing** – key responses validated against JSON schemas with `pm.response.to.have.jsonSchema`; response time under 1,000 ms for non-mashup endpoints.",
]));
C.push(P("The collection runs headless in CI with `newman run tests/postman/OpenDoor.postman_collection.json -e <env> --reporters cli,htmlextra`. [[Insert the Newman summary: total requests, assertions, failures, and a screenshot of the HTML report.]]"));
C.push(H2("7.3 Load / Stress Testing"));
C.push(...table(["Item", "Details"], [
  ["Target component", "API Gateway → Core Service: `GET /api/job-postings?match=1&page=1` (candidate token; matching query with `withCount`), plus `GET /api/job-postings/{id}` as a secondary sampler"],
  ["Tool", "Apache JMeter 5.6 (test plan `tests/jmeter/opendoor-matching.jmx`), run in CLI mode: `jmeter -n -t opendoor-matching.jmx -l results.jtl -e -o report/`"],
  ["Workload", "Thread Group: 50 users, ramp-up 60 s, 10 loops each (500 search requests + 500 detail requests); CSV Data Set with 50 seeded candidate tokens; database seeded with 500 postings and 20 accommodation types. A stress step repeats with 100 and 200 users."],
  ["Metrics", "Average and median response time, 95th percentile (P95), throughput (requests/s), error rate (%); targets: P95 < 1,500 ms and error rate < 1% at 50 users"],
  ["Observed result", "[[Record average, P95, throughput and error rate for 50 / 100 / 200 users from the JMeter HTML dashboard.]]"],
  ["Interpretation", "[[Explain whether targets were met, where the limit is (e.g., the user count at which P95 or errors rise), and limitations: hobby-tier instances, shared MySQL, test run from one client machine, results not representative of production scale.]]"],
], [2400, 7680], { kv: true }));
C.push(H2("7.4 Defects and Corrections"));
C.push(P("[[Record the real integration defects found during development and testing. Use the table below; examples of the kind of defects to watch for are listed so the team can recognize them, but only defects that actually occurred should be submitted.]]"));
C.push(...table(["ID", "Defect", "Cause", "Correction", "Verified by"], [
  ["D01", "[[Defect]]", "[[Cause]]", "[[Correction]]", "[[Test ID]]"],
  ["D02", "[[Defect]]", "[[Cause]]", "[[Correction]]", "[[Test ID]]"],
  ["D03", "[[Defect]]", "[[Cause]]", "[[Correction]]", "[[Test ID]]"],
], [800, 2400, 2300, 2900, 1680]));
C.push(note("Typical integration defects to check for: CORS preflight blocked between Vercel and the gateway; gateway stripping the Authorization header; Nominatim requests rejected without a User-Agent; SOAP namespace mismatch between WSDL and SoapClient; time-zone differences in the 30-day feedback rule; trust score not recalculated when feedback is hidden."));

// ---------- 8 Deployment ----------
C.push(H1("8. Deployment and DevOps"));
C.push(H2("8.1 Deployment Architecture"));
C.push(...fig("fig5_deployment.png", 2200, 1280, "Deployment architecture: Vercel and Railway, public and private network boundaries, CI/CD path"));
C.push(H2("8.2 Cloud Deployment"));
C.push(...table(["Component", "Provider / Platform", "URL / Host", "Configuration"], [
  ["React SPA", "Vercel (Hobby)", "[[https://opendoor.vercel.app]]", "Root `frontend/`; build `npm run build`; output `dist/`; `VITE_API_URL` = gateway URL; SPA rewrite to `index.html`"],
  ["API Gateway", "Railway service (Nixpacks/Node 22)", "[[https://opendoor-gateway.up.railway.app]] (public domain)", "`CORE_URL`, `INSIGHTS_URL` (internal hostnames), `CORS_ALLOWED_ORIGIN`, rate-limit settings; health check `/api/health`"],
  ["Core Service", "Railway service (Dockerfile: php-fpm + nginx)", "core-api.railway.internal:8001 (no public domain)", "`APP_ENV=production`, `APP_DEBUG=false`, `DB_*`, `REGISTRY_WSDL_URL`, `SERVICE_KEY_INSIGHTS`; release command `php artisan migrate --force`"],
  ["Insights Service", "Railway service (Node 22)", "insights.railway.internal:8002 (no public domain)", "`CORE_INTERNAL_URL`, `SERVICE_KEY_INSIGHTS`, `NOMINATIM_CONTACT_EMAIL`, `CACHE_DB_*`; optional `PSGC_URL`, `NOMINATIM_URL`, `OVERPASS_URL` (e.g., a second Overpass instance)"],
  ["Business Registry (SOAP)", "Railway service (Dockerfile: PHP 8.3 + SoapServer)", "registry.railway.internal:8003 (no public domain)", "`REGISTRY_SOAP_USER/PASSWORD`; SQLite file seeded at build"],
  ["MySQL 8", "Railway managed database", "mysql.railway.internal:3306", "Schemas `opendoor_core` and `insights_cache` with separate users; daily backups (Railway)"],
], [1700, 2200, 2700, 3480], { size: 16 }));
C.push(P("**Limitations.** The Railway Hobby plan (about US$5/month after the trial credit) and Vercel Hobby are not sized for production load; services may cold-start, so the team opens the application a few minutes before the demonstration. Demo accounts for every role and enough feedback to show a published trust score are seeded; a second demo employer has two responses and a demo candidate's hire with the feedback window open, so the third response (test T10) can be shown live. Both URLs are documented in the README and submitted before the defense."));
C.push(H2("8.3 Git and Repository Workflow"));
C.push(P("OpenDoor uses one GitHub **monorepo** so that contracts, services and tests change together:"));
C.push(...code(`
opendoor/
├─ frontend/                    React SPA (Vite)
├─ gateway/                     Node.js Express API Gateway
├─ services/
│  ├─ core-api/                 Laravel 13 Core Service
│  ├─ insights-service/         Node.js mashup service
│  └─ business-registry-soap/   PHP SoapServer + WSDL + seed data
├─ tests/
│  ├─ postman/                  collection + environments
│  └─ jmeter/                   .jmx test plans + CSV data
├─ docs/                        architecture diagrams, API reference, this document
├─ .github/workflows/ci.yml     CI/CD pipeline
└─ README.md                    setup, URLs, demo accounts (no secrets)`));
C.push(...bullets([
  "**Branches:** `main` (deployed, protected), `develop` (integration), and short-lived `feature/<module>-<desc>` branches (e.g., `feature/M5-matching`, `feature/soap-registry`), plus `fix/<desc>`.",
  "**Commits:** Conventional Commits (`feat(core): add match ranking`, `fix(gateway): forward Authorization header`, `test(postman): add T06`).",
  "**Pull requests:** every change goes through a PR into `develop` with at least one reviewer and a green CI run; `develop` is merged into `main` for releases, tagged `v1.0`, `v1.1`, ….",
  "**Issues:** GitHub Issues/Projects board with one issue per module feature (F1.1 … F13.5) and per integration task, linked to PRs.",
]));
C.push(H2("8.4 CI/CD Workflow"));
C.push(P("GitHub Actions workflow `.github/workflows/ci.yml`:"));
C.push(...table(["Stage", "Trigger", "Steps"], [
  ["Validate & test", "Pull request to `develop` or `main`; push to `develop`", "Path-filtered jobs run in parallel: **frontend** – `npm ci`, oxlint (with `jsx-a11y` accessibility rules), Vitest unit tests (React Testing Library), `npm run build`, axe accessibility check on the built pages; **gateway** and **insights-service** – `npm ci`, lint, unit tests (Jest, with external APIs mocked); **core-api** – `composer install`, Laravel Pint, `php artisan test` against a MySQL service container (policies, status transitions, trust score); **business-registry-soap** – `php -l`, WSDL validated with `xmllint`, SOAP smoke test."],
  ["Integration test", "Same as above, after the jobs pass", "`docker compose up` of gateway, core, insights (external APIs replaced by a mock server), registry and MySQL; seed data; run Newman with the `ci` environment; upload the HTML report as an artifact."],
  ["Deploy", "Push/merge to `main`", "Vercel and Railway GitHub integrations build and deploy the changed components automatically; Laravel migrations run as the Railway release command."],
  ["Post-deploy smoke test", "After deploy on `main`", "Newman runs the smoke folder (health, login, search, snapshot) against the production gateway; failure marks the run red and the team rolls back with Railway/Vercel \"redeploy previous\"."],
], [1800, 2400, 5880], { size: 16 }));
C.push(H2("8.5 Environment and Startup Instructions"));
C.push(P("Full instructions are in the repository README. Local development runs every component natively (PHP 8.3+, Composer, Node.js 22, MySQL 8); Docker is used only by the CI pipeline and the Railway images. Summary (no real secret values shown):"));
C.push(...code(`
# 1. Clone and copy environment files
git clone <repository-url> opendoor && cd opendoor
cp services/core-api/.env.example services/core-api/.env      # repeat for each component

# 2. Create the databases once (MySQL 8): opendoor_core and insights_cache, each with its own user
mysql -u root -p < docs/setup/create-databases.sql

# 3. Core Service (Laravel)                       http://localhost:8001
cd services/core-api && composer install && php artisan key:generate
php artisan migrate --seed && php artisan serve --port=8001

# 4. Business Registry (SOAP)                     http://localhost:8003/soap?wsdl
cd services/business-registry-soap && php seed.php && php -S localhost:8003 -t public

# 5. Insights Service and API Gateway             http://localhost:8002, http://localhost:8080
cd services/insights-service && npm ci && npm run dev
cd gateway && npm ci && npm run dev

# 6. React client                                 http://localhost:5173  (VITE_API_URL=http://localhost:8080/api)
cd frontend && npm ci && npm run dev

# 7. Run tests
cd services/core-api && php artisan test
npx newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/local.postman_environment.json`));

// ---------- 9 Screens ----------
C.push(H1("9. Application Screens and Demonstration"));
C.push(H2("9.1 Key Application Screens"));
C.push(note("[[Insert the screenshots from the existing UI into the boxes below. Keep or remove screens to match the final build; each caption already states the related business function.]]"));
[
  ["Public – Browse jobs (/jobs)", "Guests search by keyword and filter by category and accommodation; job cards show accommodation icons and the employer's Verified badge (M5)."],
  ["Candidate – Profile and accommodation needs (/candidate/profile)", "The candidate records accommodation needs once from the shared, grouped list; disability type is optional and private (M2)."],
  ["Candidate – Find jobs in \"Matches my needs\" mode (/candidate/jobs)", "Postings ranked by needs met, with \"Meets 4 of 5 of your needs\" and the missing accommodation named – the output of the matching integration (M5)."],
  ["Candidate – Job details with Accessibility Snapshot (/candidate/jobs/:id)", "One page combines the posting, trust score and nearby accessible places from the Insights mashup (Core + Nominatim + Overpass + PSGC); Apply with interview accommodation request (M4, M6, M7)."],
  ["Candidate – My applications and feedback form", "Status tracking, withdraw or confirm hire, and per-accommodation post-hire rating (M6, M7)."],
  ["Employer – Create/edit posting (/employer/jobs/new)", "Structured accommodations with notes, interview format, PSGC location picker (M4)."],
  ["Employer – Applicants and trust score", "Review applicants, mark Hired/Rejected; see the aggregated trust score and per-accommodation breakdown (M6, M7)."],
  ["Admin – Employer verification with registry check (/admin/employers)", "Result of the SOAP Business Registry check shown beside the employer's submitted details before approval (M3, M10)."],
  ["Admin – Dashboard and analytics (/admin/dashboard)", "Users by role, pending queues, applications and hires per month, most-needed accommodations (M8)."],
].forEach(([cap, fn]) => C.push(...screenshotSlot(cap, fn)));
C.push(H2("9.2 End-to-End Demonstration Scenario"));
C.push(...numbered([
  "**User action in client application:** the demo candidate (needs: wheelchair-accessible entrance, accessible restroom, flexible hours, screen-reader-compatible tools, sign language interpreter) logs in, opens Find jobs and clicks the top-ranked \"Data Encoder\" posting showing \"Meets 4 of 5 of your needs\".",
  "**Gateway/integration request:** the SPA sends `GET /api/job-postings/42?match=1` and `GET /api/insights/job-postings/42` to the API Gateway, which adds an `X-Request-ID` and routes them to the Core and Insights services.",
  "**Service-to-service interaction:** the Core Service authenticates the token, computes the match and returns the trust score; the Insights Service calls the Core Service's internal summary endpoint with its service key.",
  "**External/legacy API interaction:** the Insights Service resolves the PSGC code, geocodes the address with Nominatim and queries Overpass for wheelchair-tagged places within 500 m. (Separately, the admin demo shows the Core Service calling the SOAP Business Registry to verify the posting's employer.)",
  "**Transformation/mashup:** OSM tags are mapped to accessible transit, toilets and parking with distances, and merged with the employer's advertised accommodations and the community trust score into the Workplace Accessibility Snapshot.",
  "**Final result shown to user:** the job details page shows the match badge, the unmet accommodation, the Verified badge, \"86% – based on 5 hires\", and the nearest accessible MRT stop; the candidate applies with an interview accommodation request and sees the application as Pending, while the employer receives a notification.",
]));

// ---------- 10 Evaluation ----------
C.push(H1("10. Evaluation of the Final Solution"));
C.push(H2("10.1 Achievement of Objectives"));
C.push(...table(["Objective", "Success Measure", "Result / Evidence"], [
  ["1 – Integrated application", "All Must-have modules work end to end through the gateway; T01–T11 pass", "[[Achieved / Partly achieved – evidence]]"],
  ["2 – Service, external and legacy integration", "Snapshot built from 4 sources; SOAP registry check stored; degradation works (T12–T16)", "[[Evidence]]"],
  ["3 – Security", "Security tests T08, T09, T16 pass; no secrets in repository (secret scan)", "[[Evidence]]"],
  ["4 – Quality assurance", "Newman run with 0 failed assertions; JMeter P95 < 1,500 ms and error rate < 1% at 50 users", "[[Evidence]]"],
  ["5 – Cloud deployment and DevOps", "Public URLs working; CI green on main; automatic deploy and smoke test", "[[Evidence]]"],
  ["6 – Accessibility and usability", "No critical axe/Lighthouse issues; NVDA walkthrough; mean SUS ≥ 68 (n ≥ 5 PWD, 3 employers)", "[[Evidence]]"],
], [2600, 4000, 3480]));
C.push(H2("10.2 Technical Limitations"));
C.push(...bullets([
  "**Simulated legacy integration:** the Business Registry is a SOAP simulation with seeded data, not the real DTI/SEC systems; real integration would require an agreement with those agencies.",
  "**Open data coverage:** accessibility data near workplaces depends on OpenStreetMap tagging, which is incomplete in many Philippine areas; absence of data does not mean a place is inaccessible.",
  "**Provider restrictions:** public Nominatim and Overpass instances are rate-limited and intended for light use; heavier use would need self-hosted instances or a commercial provider.",
  "**Scale:** hobby-tier hosting, a single MySQL instance shared by two schemas, and synchronous calls limit throughput; no message queue or horizontal scaling is used.",
  "**Security scope:** no multi-factor authentication or OAuth 2.0; service keys are static shared secrets rather than mutual TLS or signed tokens.",
  "**Trust score validity:** the score depends on honest self-reported feedback and needs enough hires per employer to be meaningful.",
  "[[Add any feature that was not completed or was simplified in the final build.]]",
]));
C.push(H2("10.3 Recommended Improvements"));
C.push(...bullets([
  "**Asynchronous events (message queue):** publish `application.status_changed` and `feedback.saved` events (e.g., RabbitMQ or Redis Streams) so notifications, email and trust-score recalculation run outside the request – improves response time and resilience.",
  "**OAuth 2.0 / OpenID Connect sign-in** (e.g., Google) and optional multi-factor authentication – easier and safer login for users who rely on assistive technology to type passwords.",
  "**Official data partnerships:** integrate with PhilJobNet/PESO or DTI/SEC if APIs become available, replacing the simulated registry and avoiding duplicate registration.",
  "**Signed service tokens or mutual TLS** between services instead of static keys.",
  "**Observability:** centralized logs and tracing (OpenTelemetry) keyed by `X-Request-ID`, and uptime alerts.",
  "**Contributing back to OpenStreetMap:** let hired PWDs suggest accessibility tags for their workplace area to improve the open data that the mashup relies on.",
]));
C.push(H2("10.4 Lessons Learned"));
C.push(P("[[Summarize the team's actual lessons. Suggested prompts: architectural – where service boundaries helped or added overhead; integration – handling external rate limits, SOAP namespaces and XML-to-JSON mapping; testing – value of Postman assertions in CI and what JMeter revealed; teamwork – how API contracts written first let frontend and backend work in parallel; deployment – private networking, environment variables and cold starts.]]"));

// ---------- 11 Team ----------
C.push(H1("11. Team Contribution"));
C.push(...table(["Member", "Primary Responsibilities", "Key Deliverables / Commits", "Approx. Contribution"], [
  ["[[Name]]", "Project lead; API Gateway; service contracts; CI/CD", "[[gateway/, .github/workflows/ci.yml, PR links]]", "[[%]]"],
  ["[[Name]]", "Core Service (Laravel), database schema, matching, trust score", "[[services/core-api/, PR links]]", "[[%]]"],
  ["[[Name]]", "Accessibility Insights mashup; SOAP Business Registry", "[[services/insights-service/, services/business-registry-soap/]]", "[[%]]"],
  ["[[Name]]", "React SPA, accessibility (WCAG 2.1 AA)", "[[frontend/, PR links]]", "[[%]]"],
  ["[[Name]]", "Postman/Newman, JMeter, deployment, documentation", "[[tests/, docs/, deployment notes]]", "[[%]]"],
], [1800, 3200, 3480, 1600]));
C.push(P("[[Add a short statement explaining how the team verified contributions (e.g., GitHub commit and PR history, issue assignments, weekly stand-up notes) and how overlapping responsibilities (e.g., shared API contracts between frontend and Core Service) were resolved.]]"));

// ---------- 12 References ----------
C.push(H1("12. References"));
[
  "Access Careers. (n.d.). Access Careers. Retrieved September 28, 2026, from http://careers.axlearning.org/",
  "Apache Software Foundation. (n.d.). Apache JMeter user's manual. https://jmeter.apache.org/usermanual/",
  "Axios. (n.d.). Axios documentation. https://axios-http.com/docs/intro",
  "Department of Labor and Employment. (n.d.). PhilJobNet and PESO Employment Information System. Retrieved September 28, 2026, from https://philjobnet.gov.ph/",
  "Deque Systems. (n.d.). axe-core: Accessibility engine for automated web UI testing. https://github.com/dequelabs/axe-core",
  "Express.js. (n.d.). Express 4.x API reference. https://expressjs.com/",
  "GitHub. (n.d.). GitHub Actions documentation. https://docs.github.com/actions",
  "Laravel. (n.d.). Laravel 13.x documentation: Sanctum, Authorization, Validation. https://laravel.com/docs/13.x",
  "Meta Open Source. (n.d.). React documentation (version 19). https://react.dev/",
  "National Privacy Commission. (2016). Implementing rules and regulations of Republic Act No. 10173, known as the Data Privacy Act of 2012. https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/",
  "nock. (n.d.). nock: HTTP server mocking and expectations library for Node.js. https://github.com/nock/nock",
  "OASIS. (2006). Web Services Security UsernameToken Profile 1.1. https://docs.oasis-open.org/wss/v1.1/",
  "OpenJS Foundation. (n.d.). Jest documentation. https://jestjs.io/",
  "OpenStreetMap Foundation. (n.d.). Nominatim usage policy. https://operations.osmfoundation.org/policies/nominatim/",
  "OpenStreetMap Wiki. (n.d.). Overpass API; Key:wheelchair. https://wiki.openstreetmap.org/wiki/Overpass_API",
  "Oxc Project. (n.d.). Oxlint linter. https://oxc.rs/docs/guide/usage/linter",
  "Philippine Statistics Authority. (n.d.). Philippine Standard Geographic Code (PSGC). https://psa.gov.ph/classification/psgc",
  "PHP Group. (n.d.). SOAP extension (SoapServer, SoapClient). https://www.php.net/manual/en/book.soap.php",
  "Postman. (n.d.). Writing tests and running collections with Newman. https://learning.postman.com/docs/",
  "PSGC API. (n.d.). Philippine Standard Geographic Code API. https://psgc.gitlab.io/api/",
  "PWD-E. (n.d.). PWD-E: Future begins today. Retrieved September 28, 2026, from https://pwd-e.com/home/",
  "Railway. (n.d.). Private networking. https://docs.railway.com/",
  "Rappler. (2023). Still a long road ahead: PWDs struggle to join Philippine workforce. https://www.rappler.com/newsbreak/in-depth/persons-with-disability-struggle-philippine-workforce/",
  "Remix Software. (n.d.). React Router documentation (version 7). https://reactrouter.com/",
  "Republic Act No. 7277. (1992). Magna Carta for Disabled Persons. Official Gazette of the Republic of the Philippines.",
  "Republic Act No. 10173. (2012). Data Privacy Act of 2012. Official Gazette of the Republic of the Philippines.",
  "Republic Act No. 10524. (2013). An Act expanding the positions reserved for persons with disability, amending Republic Act No. 7277. Official Gazette of the Republic of the Philippines.",
  "Respicio & Co. (n.d.). PWD right to reasonable accommodation in the workplace (Philippines). https://www.lawyer-philippines.com/",
  "SDDirect. (2023). Disability inclusion in the Philippines (Disability Inclusion Helpdesk Report No. 61). https://sddirect.org.uk/",
  "Testing Library. (n.d.). React Testing Library. https://testing-library.com/docs/react-testing-library/intro/",
  "United Nations. (n.d.). Goal 8: Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all. https://sdgs.un.org/goals/goal8",
  "Vercel. (n.d.). Vite on Vercel. https://vercel.com/docs",
  "Vitest. (n.d.). Vitest documentation. https://vitest.dev/",
  "W3C. (2007). SOAP Version 1.2 and Web Services Description Language (WSDL) 1.1 notes. https://www.w3.org/TR/wsdl",
  "W3C. (2018). Web Content Accessibility Guidelines (WCAG) 2.1. https://www.w3.org/TR/WCAG21/",
].forEach((r) => C.push(new Paragraph({ children: runs(r), indent: { left: 720, hanging: 720 }, spacing: { after: 100 } })));

// ---------- Appendices ----------
C.push(H1("Appendices"));
C.push(H2("Appendix A - API endpoint reference / OpenAPI or equivalent"));
C.push(P("Base URL: `{GATEWAY}/api`. Access: P = public, C = candidate, E = employer, A = administrator, S = internal service key. The complete machine-readable contract (request and response schemas, error codes, enums) is `docs/openapi.yaml` (OpenAPI 3.1) in the repository."));
C.push(...table(["Module", "Method", "Endpoint", "Access", "Purpose"], [
  ["M1 Auth", "POST", "/register, /login, /logout", "P / any", "Account, token, logout"],
  ["M1 Auth", "GET, PUT", "/me, /me/password", "any", "Current user; change password"],
  ["M1 Auth", "POST", "/forgot-password, /reset-password", "P", "Email a reset link (same answer for every email, 5/min); new password with the link (valid 60 min; signs out everywhere)"],
  ["M2 Profile", "GET, PUT", "/candidate/profile", "C", "Own profile"],
  ["M2 Profile", "PUT", "/candidate/accommodations", "C", "Replace needs"],
  ["M2 Profile", "POST", "/candidate/resume", "C", "Upload PDF résumé (max 5 MB)"],
  ["M2 Profile", "GET", "/resumes/{id}?expires=&signature=", "P (signed link)", "Open résumé PDF (link valid 30 min)"],
  ["M3 Company", "GET, PUT", "/employer/company", "E", "Own company profile"],
  ["M3 Company", "GET", "/employers/{id}", "P", "Public employer page"],
  ["M3 Company", "GET", "/employers/{id}/logo", "P", "Company logo (PNG/JPG/WebP, max 2 MB)"],
  ["M3 Company", "GET", "/admin/employers, /admin/employers/{id}", "A", "Verification queue / details with latest registry check"],
  ["M3 Company", "PATCH", "/admin/employers/{id}/verify", "A", "check (SOAP) / approve / reject"],
  ["M4 Postings", "GET", "/employer/job-postings", "E", "Own postings"],
  ["M4 Postings", "POST", "/job-postings", "E", "Create"],
  ["M4 Postings", "PUT, DELETE", "/job-postings/{id}", "E (owner)", "Update / soft-delete"],
  ["M4 Postings", "PATCH", "/job-postings/{id}/status", "E (owner)", "Close / reopen"],
  ["M4 Postings", "GET", "/admin/job-postings", "A", "Approval queue"],
  ["M4 Postings", "PATCH", "/admin/job-postings/{id}/approve", "A", "Approve / reject (with reason)"],
  ["M4 Postings", "DELETE", "/admin/job-postings/{id}", "A", "Remove any posting with a reason (soft delete; employer notified)"],
  ["M5 Search", "GET", "/job-postings?q=&category=&accommodations[]=&match=1&sort=&page=", "P (match, saved: C)", "Search, filter, match"],
  ["M5 Search", "GET", "/job-postings/{id}", "P", "Details (+ match, saved and own application for C)"],
  ["M5/M11", "GET", "/categories, /accommodations", "P", "Filter options"],
  ["M6 Applications", "POST", "/job-postings/{id}/applications", "C", "Apply"],
  ["M6 Applications", "GET", "/applications, /applications/{id}", "C (own) / E (own postings)", "List / details"],
  ["M6 Applications", "PATCH", "/applications/{id}/status", "C / E", "Status transition"],
  ["M7 Feedback", "GET", "/applications/{id}/feedback-form", "C (hired)", "Items to rate (recorded at hire), window, submitted"],
  ["M7 Feedback", "POST", "/applications/{id}/feedback", "C (hired, 30 days)", "Submit"],
  ["M7 Feedback", "GET", "/employers/{id}/trust-score", "P", "Score and breakdown (from 3 responses)"],
  ["M8 Dashboards", "GET", "/candidate/dashboard, /employer/dashboard, /admin/dashboard", "C / E / A", "Summaries"],
  ["M9 Notifications", "GET, PATCH", "/notifications, /notifications/{id}/read, /notifications/read-all", "C / E", "List, mark read"],
  ["M10 Moderation", "GET, PATCH", "/admin/users, /admin/users/{id}/suspend", "A", "Users"],
  ["M10 Moderation", "POST", "/job-postings/{id}/reports", "C", "Report posting"],
  ["M10 Moderation", "GET, PATCH", "/admin/reports, /admin/reports/{id}", "A", "Review reports"],
  ["M10 Moderation", "GET", "/admin/feedback", "A", "Feedback for moderation (anonymous)"],
  ["M10 Moderation", "PATCH", "/admin/feedback/{id}/hide", "A", "Hide feedback"],
  ["M11 Master data", "GET", "/admin/accommodations", "A", "All types incl. retired"],
  ["M11 Master data", "POST, PUT, DELETE", "/admin/categories/{id}, /admin/accommodations/{id}", "A", "Manage lists (in use: category 422, accommodation retired)"],
  ["M12 Saved jobs", "GET, POST, DELETE", "/candidate/saved-jobs, /candidate/saved-jobs/{jobId}", "C", "Bookmarks of visible postings; POST and DELETE idempotent; `saved` flag on search results and posting details"],
  ["M13 Settings", "PUT", "/me/display-prefs", "any", "Text size, contrast, motion saved with the account (returned by login and /me)"],
  ["M13 Settings", "PUT", "/me/email-notifications", "C / E", "Notification emails on (default) or off"],
  ["Insights", "GET", "/insights/job-postings/{id}", "P", "Accessibility Snapshot"],
  ["Insights", "GET", "/insights/locations/{regions|provinces|cities}?parent=", "P", "PSGC lists"],
  ["Internal", "GET", "/internal/job-postings/{id}/summary (Core, not public)", "S", "Data for mashup"],
  ["Gateway", "GET", "/health", "P", "Health of gateway and services"],
], [1600, 1300, 3800, 1600, 1780], { size: 15 }));
C.push(P("**Role permission summary** (C = create, R = read, U = update, D = delete; enforced by Laravel Policies):"));
C.push(...table(["Data", "Guest", "Candidate", "Employer", "Admin"], [
  ["User account", "C (register), U (reset password by email link)", "R, U own (password, settings)", "R, U own (password, settings)", "C admins, R all, U (suspend)"],
  ["Candidate profile and needs", "–", "C, R, U own", "R (own applicants only)", "R"],
  ["Company profile", "R (public)", "R (public)", "C, R, U own", "R, U (verify)"],
  ["Job posting", "R (open)", "R (open)", "C, R, U, D own", "R all, U (approve), D"],
  ["Application", "–", "C, R own, U (withdraw, confirm hire)", "R, U status (own postings)", "R"],
  ["Accommodation feedback", "–", "C, R own (once, after hire)", "– (score only)", "R, U (hide)"],
  ["Trust score", "R (3+ responses)", "R (3+ responses)", "R own", "R all"],
  ["Categories and accommodation types", "R", "R", "R", "C, R, U, D"],
  ["Reports on postings", "–", "C (visible postings, one open per posting)", "–", "R, U (dismiss / action)"],
  ["Notifications", "–", "R, U own (mark read)", "R, U own (mark read)", "–"],
  ["Saved jobs", "–", "C, R, D own (visible postings)", "–", "–"],
], [2400, 1500, 2200, 2100, 1880], { size: 16 }));
C.push(P("A **visible posting** is open, approved, not deleted, and its employer's account is not suspended. Only visible postings appear in search, on the public employer page and in the Accessibility Snapshot, and only they can be opened, saved, applied to or reported by guests and candidates; owners and administrators still see the others."));

C.push(H2("Appendix B - Representative JSON/XML/SOAP samples"));
C.push(P("JSON samples: Sections 4.2 and 4.5. SOAP request, response and fault: Section 4.3. Additional samples:"));
C.push(P("**WSDL – message, portType, binding and service elements** (completes the excerpt in Section 4.3):"));
C.push(...code(`
<message name="VerifyBusinessRegistrationInput">
  <part name="parameters" element="tns:VerifyBusinessRegistrationRequest"/>
</message>
<message name="VerifyBusinessRegistrationOutput">
  <part name="parameters" element="tns:VerifyBusinessRegistrationResponse"/>
</message>
<portType name="BusinessRegistryPortType">
  <operation name="VerifyBusinessRegistration">
    <input message="tns:VerifyBusinessRegistrationInput"/>
    <output message="tns:VerifyBusinessRegistrationOutput"/>
  </operation>
</portType>
<binding name="BusinessRegistryBinding" type="tns:BusinessRegistryPortType">
  <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
  <operation name="VerifyBusinessRegistration">
    <soap:operation soapAction="urn:opendoor:registry:v1#VerifyBusinessRegistration"/>
    <input><soap:body use="literal"/></input>
    <output><soap:body use="literal"/></output>
  </operation>
</binding>
<service name="BusinessRegistryService">
  <port name="BusinessRegistryPort" binding="tns:BusinessRegistryBinding">
    <soap:address location="http://registry.railway.internal:8003/soap"/>
  </port>
</service>`));
C.push(P("**Overpass QL query** sent by the Insights Service (coordinates from Nominatim):"));
C.push(...code(`
[out:json][timeout:8];
(
  node(around:500,14.6507,121.0494)["wheelchair"~"yes|limited"];
  way(around:500,14.6507,121.0494)["wheelchair"~"yes|limited"];
);
out center tags 50;`));
C.push(P("**Internal summary returned by the Core Service** to the Insights Service:"));
C.push(...code(`
GET /internal/job-postings/42/summary      X-Service-Key: \${SERVICE_KEY_INSIGHTS}
200 { "id": 42, "address": "123 Quezon Ave., Brgy. Paligsahan", "psgc_code": "1381300000",
      "location_label": "Quezon City, National Capital Region (NCR)",
      "accommodations": [ { "id": 1, "name": "Wheelchair-accessible entrance", "group": "physical_access" } ],
      "trust_score": { "published": true, "score": 86, "based_on": 5,
                       "breakdown": [ { "accommodation_id": 1, "name": "Wheelchair-accessible entrance",
                                        "delivered": 5, "partial": 0, "not_delivered": 0, "of": 5 } ] } }`));

C.push(H2("Appendix C - Postman collection and environment reference"));
C.push(...table(["Item", "Reference"], [
  ["Collection", "`tests/postman/OpenDoor.postman_collection.json` – folders 01 Auth … 09 Negative & Security Cases (Section 7.2)"],
  ["Environments", "`local`, `ci`, `production` – variables `baseUrl`, role emails; passwords supplied from secrets / Newman `--env-var`"],
  ["Chained variables", "`candidateToken`, `employerToken`, `adminToken`, `jobPostingId`, `applicationId`, `employerId`"],
  ["CI command", "`newman run ... -e tests/postman/ci.postman_environment.json --reporters cli,htmlextra --reporter-htmlextra-export newman-report.html`"],
  ["Evidence", "[[Insert screenshot of the Postman runner / Newman HTML report and the assertion totals.]]"],
], [2400, 7680], { kv: true }));

C.push(H2("Appendix D - JMeter/load-test configuration and results"));
C.push(...table(["Element", "Configuration"], [
  ["Test plan", "`tests/jmeter/opendoor-matching.jmx`"],
  ["User Defined Variables", "`host` = gateway host, `protocol` = https, `pageSize` = 12"],
  ["CSV Data Set Config", "`tokens.csv` – 50 seeded candidate tokens (generated by a seeder in a test environment, never production users)"],
  ["Thread Groups", "Load: 50 threads, 60 s ramp-up, 10 loops · Stress: 100 and 200 threads, 60 s ramp-up, 5 loops"],
  ["Samplers", "HTTP Request `GET /api/job-postings?match=1&page=${__Random(1,10)}`; HTTP Request `GET /api/job-postings/${postingId}`"],
  ["Header Manager", "`Authorization: Bearer ${token}`, `Accept: application/json`"],
  ["Assertions", "Response Assertion: code 200; JSON Assertion: `$.meta.match_mode == true`; Duration Assertion: 3,000 ms"],
  ["Listeners", "Summary Report, Aggregate Report; HTML dashboard generated with `-e -o report/`"],
  ["Results", "[[Insert the Aggregate Report table and the response-time-over-time chart for each run.]]"],
], [2400, 7680], { kv: true }));

C.push(H2("Appendix E - Repository structure / deployment notes"));
C.push(P("Repository structure: Section 8.3. Additional deployment notes:"));
C.push(...bullets([
  "Local development runs natively (Section 8.5). `docker-compose.yml` is used only in CI: it defines `mysql`, `core-api`, `insights-service`, `business-registry-soap`, `gateway` and a `mock-external` server so tests never depend on public Nominatim/Overpass.",
  "Railway: one project, five services plus MySQL; only `gateway` has a public domain; services reference each other with `${{service.RAILWAY_PRIVATE_DOMAIN}}` variables.",
  "Laravel production: `php artisan config:cache route:cache`, `migrate --force` on release, queue driver `sync` (no worker needed in v1.0).",
  "Seeders: categories (about 10 industries), RA 7277-based accommodation types, one administrator, demo candidate/employer accounts, sample feedback that publishes one employer's trust score (plus a second employer with two responses and an open demo hire for test T10), and sample DTI/SEC records in `registry.db`.",
  "Before the defense: open the frontend and call `/api/health` a few minutes early to wake sleeping services.",
]));

C.push(H2("Appendix F - Additional screenshots or diagrams"));
C.push(P("**Core Service data model** (MySQL `opendoor_core`). Accommodations are stored once in a lookup table and linked to postings, candidate needs and feedback through pivot tables, so the same vocabulary drives filtering, matching and per-accommodation ratings."));
C.push(...table(["Table", "Key Fields", "Notes"], [
  ["users", "id, name, email, password, role, is_active, consented_at, display_prefs (JSON), email_notifications, timestamps", "Shared auth table (Sanctum); unique email; suspension; consent; M13 settings (emails on by default)"],
  ["password_reset_tokens", "email (PK), token (hashed), created_at", "One reset link per account; valid 60 minutes, removed once used"],
  ["candidate_profiles", "id, user_id, headline, skills, experience, location_psgc, location_label, disability_type (nullable), show_disability, resume_path", "1:1 with candidate users; disability type optional and hidden"],
  ["employers", "id, user_id, company_name, business_reg_no, registry_type, industry, address, location_psgc, location_label, description, logo_path, verified_at, verification_rejected_reason, trust_score, feedback_count", "`trust_score` is a whole percentage 0–100 (null until rated); shown publicly only from 3 responses"],
  ["registry_checks", "id, employer_id, business_reg_no, registry_type, status, registered_name, name_match_score, raw_response (XML answer), checked_by, checked_at", "Every SOAP verification call; `ERROR` when the registry could not answer"],
  ["categories / accommodations", "id, name / id, name, group, description, is_retired", "Admin-managed lists"],
  ["job_postings", "id, employer_id, category_id, title, description, address, location_psgc, location_label, employment_type, work_setup, interview_format, status, closes_at, is_approved, rejection_reason, deleted_at", "Soft deletes; indexes (status, category_id) and (employer_id, status); MySQL full-text index on title and description (keyword search currently uses a case-insensitive LIKE)"],
  ["job_posting_accommodation", "job_posting_id, accommodation_id, note", "Pivot: accommodations provided"],
  ["candidate_accommodation", "candidate_profile_id, accommodation_id", "Pivot: accommodations needed"],
  ["applications", "id, job_posting_id, candidate_profile_id, status, reviewed_at, cover_note, interview_request, hired_at, feedback_reminded_at, hire_confirmed_by, timestamps", "Unique (job_posting_id, candidate_profile_id); `reviewed_at`/`hired_at` date the status timeline; `feedback_reminded_at` makes the rating reminder a one-time notice"],
  ["application_accommodation", "application_id, accommodation_id", "Pivot: the posting's accommodations recorded when the application becomes hired (the items the candidate rates)"],
  ["feedback / feedback_items", "id, application_id, comments, is_hidden / id, feedback_id, accommodation_id, rating", "One feedback per application; one rating per accommodation recorded at hire; hidden feedback leaves the score"],
  ["notifications", "Laravel notifications table: id (time-ordered UUIDv7), type, notifiable, data (message, url, ids), read_at", "In-app notices for candidates and employers; the same notice is emailed when the user's emails are on"],
  ["reports", "id, reporter_id, job_posting_id, reason, status, note, resolved_by, resolved_at, timestamps", "One open report per candidate and posting; `note` and resolver set only when an administrator resolves it"],
  ["saved_jobs", "candidate_profile_id, job_posting_id, timestamps", "Composite primary key; bookmarks kept when a posting closes and listed again if it reopens"],
  ["jobs / failed_jobs", "Laravel database queue tables", "Queued password-reset emails, worked by the scheduler every minute"],
], [2300, 4900, 2880], { size: 16 }));
C.push(P("**Enumerated values** (stored as MySQL `ENUM` columns or PHP backed enums; the same values appear in the API and in `docs/openapi.yaml`):"));
C.push(...table(["Field", "Allowed values"], [
  ["users.role", "`candidate`, `employer`, `admin`"],
  ["users.display_prefs", "`text_size`: 100, 125, 150 · `contrast`: `normal`, `high` · `motion`: `normal`, `reduce`"],
  ["notifications.type", "`application_received`, `application_status_changed`, `employer_verification`, `posting_review`, `feedback_reminder`"],
  ["employers.registry_type", "`DTI`, `SEC`"],
  ["registry_checks.status", "`ACTIVE`, `EXPIRED`, `CANCELLED`, `NOT_FOUND`, `ERROR`"],
  ["accommodations.group", "`physical_access`, `communication`, `work_arrangement`, `assistive_technology`, `support`"],
  ["job_postings.employment_type", "`full_time`, `part_time`, `contract`, `internship`"],
  ["job_postings.work_setup", "`onsite`, `hybrid`, `remote`"],
  ["job_postings.interview_format", "`online`, `onsite`"],
  ["job_postings.status", "`draft`, `pending_approval`, `open`, `closed`"],
  ["applications.status", "`pending`, `reviewed`, `hired`, `rejected`, `withdrawn`"],
  ["applications.hire_confirmed_by", "`employer`, `candidate`"],
  ["feedback_items.rating", "`delivered` (1), `partial` (0.5), `not_delivered` (0)"],
  ["reports.status", "`open`, `dismissed`, `actioned`"],
  ["Snapshot `sources.*`", "`ok`, `cached`, `stale`, `unavailable`"],
  ["Location lists `X-Data-Source`", "`ok`, `cached`, `stale`, `fallback`"],
], [3000, 7080], { kv: true, size: 16 }));
C.push(P("**Insights Service cache** (MySQL `insights_cache`, owned only by the Insights Service) and **Business Registry** data (SQLite, owned only by the registry):"));
C.push(...table(["Table", "Key Fields", "Expiry / Notes"], [
  ["geocode_cache", "address_hash (PK, SHA-256 of the normalized query), query, lat, lon, precision (`street` / `city`), fetched_at", "30 days; bundled city centres (`city-centroids.json`, by PSGC code) when Nominatim fails"],
  ["overpass_cache", "key (PK, `lat,lon,radius` rounded to 4 decimals), payload (JSON), fetched_at", "24 hours; expired rows may be served as `stale` when Overpass fails"],
  ["psgc_cache", "key (PK: `regions`, `provinces:{code}`, `cities:{code}`), payload (JSON), fetched_at", "7 days; bundled JSON of all regions, provinces and their cities/municipalities (`psgc-fallback.json`) as fallback"],
  ["registrations (registry.db)", "registration_number (PK), registry_type, registered_name, status, date_registered", "Simulated DTI/SEC records seeded by `seed.php`: the two demo employers and three other businesses (ACTIVE), two EXPIRED and two CANCELLED samples"],
], [2300, 4900, 2880], { size: 16 }));
C.push(P("[[Insert the ERD image and any additional screenshots here.]]"));

// =====================================================================
const doc = new Document({
  creator: "OpenDoor Team",
  title: "OpenDoor – SIA 1 Final Project Documentation",
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: GOLD, font: FONT }, paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: "000000", font: FONT }, paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 21, bold: true, font: FONT }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bul", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u25CF", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 300 } }, run: { size: 14 } } }] },
      ...Array.from({ length: 20 }, (_, i) => ({ reference: "num" + i, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] })),
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [
      new TextRun({ text: "OpenDoor – SIA 1 Final Project Documentation   |   Page ", size: 16, color: "777777" }),
      new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "777777" })] })] }) },
    children: C,
  }],
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(OUTDIR + "OpenDoor_SIA1_Final_Project_Documentation.docx", b); console.log("written"); });
