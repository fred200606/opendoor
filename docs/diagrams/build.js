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
// Screenshots live in diagrams/screens/ (JPG or PNG). Each is scaled to the content width, but never
// taller than maxH px, and drawn in a thin frame (a one-cell table as wide as the image).
const PX = 15; // DXA per pixel at 96 dpi
function screenshot(file, wPx, hPx, maxH) {
  let width = 660, height = Math.round((hPx / wPx) * 660);
  if (height > maxH) width = Math.round((width * maxH) / height), height = maxH;
  const image = new ImageRun({ type: file.endsWith(".png") ? "png" : "jpg", data: fs.readFileSync(OUTDIR + "diagrams/screens/" + file), transformation: { width, height } });
  const frame = (width + 8) * PX;
  return [new Table({
    alignment: AlignmentType.CENTER, width: { size: frame, type: WidthType.DXA }, columnWidths: [frame],
    rows: [new TableRow({ children: [new TableCell({ width: { size: frame, type: WidthType.DXA }, borders, margins: { top: 40, bottom: 40, left: 40, right: 40 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [image] })] })] })],
  }), new Paragraph({ spacing: { after: 60 }, keepNext: true, children: [] })]; // the caption stays with its image
}
// images: [file, widthPx, heightPx, maxHeightPx][]; a slot with two images starts a new page so the
// pair and its caption stay together.
const screenSlot = (caption, fn, images) => [
  ...(images.length > 1 ? [new Paragraph({ pageBreakBefore: true, spacing: { after: 0 }, children: [] })] : []),
  ...images.flatMap(([file, w, h, maxH]) => screenshot(file, w, h, maxH)),
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
  ["Section", "IT31S1"],
  ["Instructor", "Ms. Justine Neypes"],
  ["Group Name / Number", "Group 3 – ICARUS"],
  ["Submission Date", "October 19, 2026"],
], [2600, 7480], { kv: true }));
C.push(H2("Group Members"));
C.push(...table(["Name", "Student Number", "Primary Role / Responsibility"], [
  ["Beronilla, Jianina", "[[Student No.]]", "[[Role]]"],
  ["Crisologo, Angellana", "[[Student No.]]", "[[Role]]"],
  ["Ruzgal, Francis Aaron", "[[Student No.]]", "[[Role]]"],
  ["Siochi, Onekhyle", "[[Student No.]]", "[[Role]]"],
  ["Su, Alfred G.", "[[Student No.]]", "[[Role]]"],
], [3000, 2200, 4880]));
C.push(note("Suggested division of the five integration workstreams, one per member: project lead and integration architect – API gateway, service contracts, CI/CD; Core Service developer – Laravel API, MySQL schema, matching and trust score; integration developer – Accessibility Insights mashup and SOAP Business Registry; frontend developer – React SPA, accessibility (WCAG 2.1 AA); QA and DevOps – Postman/Newman, JMeter, cloud deployment, documentation."));
C.push(H2("Document Control"));
C.push(...table(["Field", "Information"], [
  ["Application Platform", "Web (responsive single-page application usable on desktop and on 360 px phone screens)"],
  ["Repository", "https://github.com/fred200606/opendoor (private)"],
  ["Deployment / Access URL", "Frontend: https://opendoor-rust.vercel.app  ·  API Gateway: https://gateway-production-4e58.up.railway.app/api"],
  ["Version", "1.2 – release of 25 October 2026 deployed (requirements, application stages, hiring confirmation, job details and dashboards added after the first release); production secrets rotated; employer dashboard layout aligned (same day)"],
  ["Date", "October 25, 2026"],
], [2600, 7480], { kv: true }));

// ---------- Executive summary ----------
C.push(H1("Executive Summary"));
C.push(P("Persons with disabilities (PWDs) remain largely excluded from the Philippine workforce: of about 1.9 million working-age Filipinos with a disability, only around 353,000 were in the labor force in January 2022 (Rappler, 2023). Republic Act No. 7277 already requires reasonable accommodation, yet the information a PWD job seeker needs to act on that right is scattered across systems that do not exchange data. Accommodation details are buried in free-text postings on separate job boards, employer legitimacy is checked by hand against DTI and SEC registry websites, the accessibility of a workplace's surroundings is looked up separately on maps, and no system records whether advertised accommodations were actually delivered after hire."));
C.push(P("**OpenDoor** integrates these sources into one web application aligned with **SDG 8, Target 8.5** (full and productive employment and decent work for all, including persons with disabilities). Candidates complete a short profile – location, skills, education, work preferences – and record their accommodation needs once; every job posting then gets a **match score** from 0 to 100 that weighs skills, location, qualifications, work preferences and the accommodation needs it meets (\"Match: 86% · Strong match\"). Verified employers publish jobs with structured accommodation fields, required skills and optional salary details, and move applicants through a server-enforced workflow (Submitted, Under review, Shortlisted, Contacted). A hire counts only when **both the employer and the candidate confirm it** with a start date. From day 30 after that start date, the hired candidate rates each advertised accommodation, producing an anonymous **accommodation trust score** that is published only after three responses."));
C.push(P("The final architecture uses an **API Gateway** (Node.js/Express) as the single entry point for a **React** single-page application. Behind the gateway, the **Core Service** (Laravel 13, Sanctum, MySQL 8) owns users, profiles, postings, matching, applications, feedback and moderation. An **Accessibility Insights Service** (Node.js) is a mashup that combines the posting's address and accommodations from the Core Service with three external REST APIs – OpenStreetMap **Nominatim** (geocoding), the **Overpass API** (wheelchair-tagged places nearby) and the **PSGC API** (official Philippine location codes) – into a normalized \"Workplace Accessibility Snapshot\"; it also gives the Core Service the city-centre coordinates of each official location, which the matching uses for distance filters. A **Business Registry Service** exposes a WSDL-described **SOAP 1.1** interface that simulates a legacy DTI/SEC registry; the Core Service calls it with XML and WS-Security credentials during employer verification and maps the XML result to JSON."));
C.push(P("All services are deployed to the cloud: the React app on Vercel (https://opendoor-rust.vercel.app) and the gateway, services and MySQL on Railway in the Singapore region, with only the gateway exposed publicly (https://gateway-production-4e58.up.railway.app) and the other services on a private network. GitHub Actions runs linting, unit and feature tests, React builds and a Newman (Postman) API test run on every push and pull request, and the Vercel and Railway GitHub integrations deploy the main branch. Quality is verified through a Postman collection with assertions on status codes, identifiers, business values and application error codes, and through an Apache JMeter load test of the matching endpoint. In the final test run of 23 October 2026 all 16 planned integration tests passed: Newman sent 216 requests through the gateway and 1,064 of 1,065 assertions passed – the one failure was a response-time check of the map data while both public Overpass servers were down, which the snapshot handled as designed – together with 868 unit and feature tests, 39 registry checks and an axe check with no WCAG 2.1 A/AA violations on 33 pages. On the deployed system a read-only Newman smoke run passed on 25 October 2026 (80 requests, 435 assertions, 0 failures), and JMeter on the first release (16 October 2026) measured a P95 of 748 ms with 50 users active at the same time and no errors – within the 1,500 ms target. The outcome is a deployed, accessible platform in which integration – not a single database – lets PWDs find jobs that fit their needs and lets the community hold employers to their accommodation promises."));
C.push(note("[[Add the mean SUS score to the final paragraph once measured.]]"));

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
  "**Objective 1 – Integrated application.** Implement the React client, API Gateway and Core Service so that candidates, employers and administrators complete the full hiring transaction – profile with accommodation needs, \"Recommended for me\" search ranked by match score, application, server-enforced status workflow (Submitted → Under review → Shortlisted → Contacted → Hired by mutual confirmation; Not selected, Withdrawn) and per-accommodation post-hire feedback with a trust score shown after three responses – entirely through REST/JSON endpoints.",
  "**Objective 2 – Service-to-service, external and legacy integration.** Integrate (a) an Accessibility Insights mashup service that combines Core Service data with the Nominatim, Overpass and PSGC REST APIs, and (b) a WSDL/SOAP 1.1 Business Registry service used for employer verification, with documented contracts, timeouts and graceful degradation.",
  "**Objective 3 – Security.** Secure every request with Sanctum bearer tokens, role middleware and Laravel Policies; secure service-to-service calls with service keys and WS-Security credentials; and keep all secrets out of the repository.",
  "**Objective 4 – Quality assurance.** Verify the APIs and integrations with an automated Postman/Newman collection (functional, negative and integration cases) and measure performance of the matching endpoint with Apache JMeter (response time, P95, throughput, error rate).",
  "**Objective 5 – Cloud deployment and DevOps.** Deploy all components to Vercel and Railway with a private service network, and automate linting, testing, building and deployment with GitHub Actions.",
  "**Objective 6 – Accessibility and usability.** Evaluate the client against WCAG 2.1 Level AA (Lighthouse, axe, NVDA) and through the System Usability Scale with at least five PWD and three employer participants (target mean SUS ≥ 68).",
]));

C.push(H2("1.4 Scope and Limitations"));
C.push(P("**Included in scope:**"));
C.push(...bullets([
  "Public area, Candidate, Employer and Admin portals in one React application (13 functional modules, M1–M13, as defined in the OpenDoor Modules and Features Specification), with display settings (text size, high contrast, reduced motion), Read aloud and Voice input, onboarding for first-time job seekers and employers (a guided welcome tour that highlights one part of the page at a time and a \"Get started\" checklist on the dashboard), and dashboards with charts. The visual design (layout, colours, type scale, components) and the briefcase mascot are adapted, with his permission, from team member Francis Ruzgal's `opendoor-ipt` interface; routes, API calls and features are OpenDoor's own.",
  "API Gateway with routing, CORS, rate limiting, request IDs, timeouts and a uniform error envelope.",
  "Core Service (Laravel 13 + MySQL 8): authentication and roles with password reset by email; candidate profiles (a complete profile – location, at least three skills, education, work preferences – is required to apply) with skill suggestions read from the uploaded résumé; company profiles; job postings with structured accommodations, required skills, qualifications and optional salary, responsibilities, benefits and schedule; search, filters (work setup, distance) and the match score; saved jobs; application workflow with mutual hiring confirmation; feedback and trust score; dashboards with analytics; in-app and email notifications; account display settings and onboarding state; moderation; master data.",
  "Accessibility Insights Service: Workplace Accessibility Snapshot (mashup), PSGC location lookup with caching, and city-centre coordinates of a location for the Core Service (internal).",
  "Business Registry Service: SOAP 1.1 operation `VerifyBusinessRegistration` with a published WSDL, used in employer verification.",
  "Postman collection, JMeter test plan, GitHub Actions workflow, and cloud deployment.",
]));
C.push(P("**Excluded / limitations:**"));
C.push(...bullets([
  "The Business Registry Service is a **simulated** legacy system seeded with sample registrations; it does not connect to the real DTI BNRS or SEC databases, which offer no public SOAP or REST API. An administrator always makes the final verification decision.",
  "Accessibility Snapshot data depends on OpenStreetMap volunteers tagging places with `wheelchair=yes`; coverage in some Philippine areas is incomplete, so the snapshot is informational only and never used for ranking.",
  "Public Nominatim and Overpass instances have usage limits (Nominatim: at most one request per second, identifying User-Agent required), so results are cached and requests are throttled.",
  "All 13 modules were delivered, including the \"Could have\" saved jobs (M12) and display settings and email notifications (M13). In production, emails are sent through Brevo's HTTPS API (Railway blocks outbound SMTP on its trial and hobby plans); during development they are written to the Core Service log. Onboarding (welcome tour and \"Get started\" checklist) was added after the original module list. After the first release (21–23 October 2026) the team added the required profile, a shared skills list, the weighted match score with work-setup and distance filters, direct publishing for verified companies (the administrator's approval step was removed; administrators can still remove postings), the stages Shortlisted and Contacted with mutual hiring confirmation, job details (salary, responsibilities, benefits, schedule) and dashboard charts. No mobile app, payments, or video interviews are included.",
  "The match score's weights (skills 40, location 20, qualifications 15, work preferences 10, accommodation needs 15) were set by the team and are not learned from data; distance is measured between city centres, not street addresses; résumé skill suggestions read only the text of a PDF (the first 10 pages), so a scanned résumé gives none.",
  "Read aloud and Voice input use the browser's own speech features (Web Speech API). Voice input works only in browsers that offer a speech service (Chrome, Edge) and is hidden elsewhere; Chrome and Edge send the recorded audio to their vendor's speech service, so a one-time notice is shown before first use and it is never switched on by default.",
  "The deployment runs on Railway's Free Trial (a one-time US$5 credit for 30 days, at most five services per project, 1 GB RAM and shared vCPU per service) and Vercel's Hobby plan, which are not sized for production traffic (Section 7.3).",
]));

C.push(H2("1.5 Intended Users / Stakeholders"));
C.push(...table(["Stakeholder", "Type", "Role in the System"], [
  ["PWD Job Seeker (Candidate)", "Primary user", "Registers with data privacy consent; completes the profile (location, skills, education, work preferences) and records accommodation needs; browses \"Recommended for me\" ranked by match score; views the Accessibility Snapshot and trust score; applies with a résumé, withdraws, or reports and confirms a hire; rates each accommodation from day 30 after the confirmed start date; reports misleading postings."],
  ["Employer / HR Officer", "Primary user", "Registers a company with its DTI/SEC registration number; once verified, publishes jobs with structured accommodations, required skills, qualifications and optional salary; moves applicants through the stages and reports or confirms hires; views its trust score and per-accommodation breakdown."],
  ["Platform Administrator", "Administrator", "Runs registry checks and verifies employers; removes inappropriate postings; reviews reports and flagged feedback; suspends accounts; maintains categories and accommodation types; monitors the dashboard and its charts."],
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
  "**Onboard** – a candidate registers with consent, completes the profile (location, at least three skills – suggested from the uploaded résumé –, education, work preferences) and selects accommodation needs from a shared list; an employer registers a company and is verified by an administrator against the Business Registry Service (SOAP).",
  "**Post and match** – the verified employer publishes a job with structured accommodations, required skills, qualifications and optional salary; the Core Service gives every open posting a match score for the candidate (skills, location, qualifications, work preferences, accommodation needs) and ranks \"Recommended for me\" by it.",
  "**Inform** – the job details page combines the posting, \"How this job fits you\", the employer's trust score and a Workplace Accessibility Snapshot built by the Insights Service from Nominatim, Overpass and PSGC data.",
  "**Apply and decide** – the candidate applies with a résumé (optionally requesting an interview accommodation); the employer moves the application through Under review, Shortlisted and Contacted; a hire is recorded only when one side reports it with a start date and the other side confirms it.",
  "**Verify after hire** – from day 30 after the confirmed start date, the candidate rates each advertised accommodation; the Core Service recomputes the employer's trust score and publishes it after three responses.",
]));
C.push(H2("3.2 Final Architecture"));
C.push(...fig("fig2_architecture.png", 2200, 1440, "OpenDoor final architecture: client, gateway, services, databases, external REST APIs and legacy SOAP component"));
C.push(P("The React client (Vercel) sends every request over HTTPS to the API Gateway, the only public component on Railway. The gateway routes `/api/insights/*` to the Accessibility Insights Service and all other `/api/*` paths to the Core Service. The Core Service owns the `opendoor_core` MySQL database and calls the Business Registry Service over SOAP/XML. The Insights Service calls the Core Service's internal REST endpoints for posting data, calls the three external REST APIs, and stores normalized results in its own `insights_cache` database. In the other direction, the Core Service calls an internal Insights endpoint (`/internal/places/{code}`) to turn a PSGC location into city-centre coordinates for the distance filter, so all external geographic APIs stay in one service. Each service owns its data; no service reads another service's database."));
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
  ["Location data for matching", "The Core Service asks the Insights Service for a location's city-centre point (internal endpoint, service key) when a profile or posting location changes, and stores the point", "Keeps PSGC and Nominatim calls in the Insights Service instead of a second client in Core; distance filtering then runs in one SQL query on stored points. The call has a 4-second timeout and never blocks saving; a scheduled command fills missing points every 15 minutes."],
  ["Hiring confirmation", "A hire is a report by one party with a start date, confirmed by the other; the history is kept in separate tables", "The trust score must rest on real hires: an employer cannot create hires to collect ratings, and a candidate cannot rate an employer that never hired them. Keeping reports apart from the application stage lets either side report first and keeps every answer (confirm, not yet, incorrect) as evidence."],
  ["Deployment", "Vercel (client) + Railway (gateway, services, MySQL) with private networking, in Railway's Singapore region on the Free Trial", "Railway runs Docker services and managed MySQL in one project and supports internal hostnames (`*.railway.internal`); Vercel is optimized for static SPAs. Singapore is the region closest to the Philippines. The trial allows five services, so the Laravel scheduler runs inside the Core container instead of as a separate service, and email goes through an HTTPS API because the trial blocks SMTP."],
], [1900, 2900, 5280]));
C.push(H2("3.4 Component / Service Inventory"));
C.push(...table(["Component / Service", "Responsibility", "Technology", "Port / URL", "Depends On"], [
  ["React SPA (Client)", "Public area and Candidate, Employer and Admin portals; accessible UI with display settings, Read aloud, Voice input, onboarding for first-time users and dashboard charts (inline SVG, each with a table view); calls the gateway only", "React 19, Vite, React Router 7, Axios, AuthContext, Tailwind CSS 4, Lucide icons, self-hosted Lexend and Atkinson Hyperlegible fonts, Web Speech API; look and mascot adapted from Francis Ruzgal's `opendoor-ipt`", "Vercel: https://opendoor-rust.vercel.app (dev :5173)", "API Gateway"],
  ["API Gateway", "Single entry point; routing; CORS; rate limiting; X-Request-ID; timeouts; uniform error envelope; health check", "Node.js 22, Express, http-proxy-middleware, express-rate-limit", "Public: https://gateway-production-4e58.up.railway.app (dev :8080)", "Core Service, Insights Service"],
  ["Core Service", "Auth and roles, password reset, profiles with résumé skill suggestions, postings, match score, saved jobs, applications with stages and hiring confirmation, feedback and trust score, dashboards and analytics, in-app and email notifications, moderation, master data and skills list, onboarding state; scheduled jobs (close expired postings, rating reminders, queued reset emails, missing location points) run by the scheduler in the same container", "PHP 8.4, Laravel 13, Sanctum, Eloquent, smalot/pdfparser; FrankenPHP in the container", "core-api.railway.internal:8001 (dev :8001)", "MySQL opendoor_core, Business Registry Service, Insights Service (city-centre points), Brevo (email)"],
  ["Accessibility Insights Service", "Workplace Accessibility Snapshot mashup; PSGC location lookup; city-centre points for the Core Service (internal); caching and throttling", "Node.js 22, Express, Axios, mysql2", "insights-service.railway.internal:8002 (dev :8002)", "Core Service (internal API), Nominatim, Overpass, PSGC, MySQL insights_cache"],
  ["Business Registry Service (legacy)", "SOAP 1.1 `VerifyBusinessRegistration`; WSDL; simulated DTI/SEC records", "PHP 8.4 SoapServer (plain PHP, FrankenPHP in the container), SQLite","business-registry-soap.railway.internal:8003/soap, WSDL at /soap?wsdl (dev :8003)", "registry.db"],
  ["MySQL – opendoor_core", "Users, profiles, employers, postings, accommodations, applications, feedback, notifications, reports", "MySQL 8 (Railway managed)", "mysql.railway.internal:3306", "–"],
  ["MySQL – insights_cache", "Geocoding results, Overpass results, PSGC lists, with expiry", "MySQL 8 (same server, separate schema and user)", "mysql.railway.internal:3306", "–"],
  ["Nominatim (external)", "Geocoding of job addresses", "REST/JSON", "https://nominatim.openstreetmap.org", "–"],
  ["Overpass API (external)", "Query OSM elements tagged `wheelchair=yes` near a point", "REST (Overpass QL) / JSON", "https://overpass-api.de/api/interpreter; second server https://overpass.private.coffee/api/interpreter", "–"],
  ["PSGC API (external)", "Philippine regions, provinces, cities/municipalities", "REST/JSON", "https://psgc.gitlab.io/api", "–"],
  ["Brevo (external email)", "Delivers notification emails and password-reset links", "Transactional email HTTPS API through Symfony's Brevo mailer (`MAIL_MAILER=brevo`); `log` mailer in development", "https://api.brevo.com/v3/smtp/email (`BREVO_API_KEY`, verified sender in `MAIL_FROM_ADDRESS`)", "–"],
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
  ["Core", "PATCH", "/api/me/onboarding", "Onboarding of job seekers and employers: welcome tour finished or skipped; \"Get started\" list hidden or shown again", "{tour_done?, checklist_hidden?} (at least one) → 200 {tour_done, checklist_hidden}; administrators 403"],
  ["Core", "GET, PUT", "/api/candidate/profile", "View or update own profile (location, skills, education and work preferences are required to apply)", "{headline,skills[],experience,education_level,experience_years,preferred_work_setups[],preferred_employment_types[],location_psgc,...} → profile + `profile_complete`, `profile_missing[]`"],
  ["Core", "GET", "/api/candidate/resume/skill-suggestions", "Skills from the shared list found in the uploaded résumé PDF and not yet on the profile (the candidate confirms them)", "→ {data:{readable, skills[]}}; no résumé → 404; the résumé text is never stored"],
  ["Core", "GET", "/api/skills", "Shared skills list with aliases (skills are matched by name)", "→ [{id,name,aliases[]}]"],
  ["Core", "PUT", "/api/candidate/accommodations", "Replace list of accommodation needs", "{accommodation_ids:[1,4,9]} → 200 needs[]"],
  ["Core", "POST, GET", "/api/candidate/resume, /api/resumes/{id}", "Upload PDF résumé (max 5 MB); open it from a 30-minute signed link", "multipart `resume` → 200 {resume_url}; signed link → PDF"],
  ["Core", "GET", "/api/job-postings", "Search, filter and match postings (\"Recommended for me\" ranks by match score)", "?q=&category=&accommodations[]=&work_setup[]=&distance=10|25|50|100&match=1&sort=&page= → {data:[posting+match+saved], meta}"],
  ["Core", "GET", "/api/job-postings/{id}", "Posting details with match score and its parts, and the trust score", "→ posting (Section 4.2)"],
  ["Core", "POST", "/api/job-postings", "Create posting (draft, or publish at once – verified companies only)", "{title,description,skills[],education_level?,salary_min?,salary_max?,salary_period?,responsibilities?,benefits?,schedule?,...,accommodations:[{id,note}],submit} → 201; `submit:true` without verification → 422"],
  ["Core", "PUT, DELETE", "/api/job-postings/{id}", "Update or soft-delete own posting", "→ 200 / 204"],
  ["Core", "POST", "/api/job-postings/{id}/applications", "Apply (needs a complete profile and a résumé)", "{cover_note, interview_request} → 201 application; 422 `PROFILE_INCOMPLETE` / `RESUME_REQUIRED`"],
  ["Core", "GET", "/api/applications", "Own applications (candidate) or applicants (employer)", "?status=&job_posting_id= → {data:[application]}"],
  ["Core", "PATCH", "/api/applications/{id}/status", "Move the stage (server-enforced transitions)", "{status:'reviewed'|'shortlisted'|'contacted'|'rejected'|'withdrawn'} → 200 (dates `reviewed_at`, `shortlisted_at`, `contacted_at` for the timeline); `hired` only through a confirmed hiring report"],
  ["Core", "POST", "/api/applications/{id}/hiring-reports, …/hiring-reports/{report}/response", "Report a hire with a start date; the other party answers Confirm, Not yet or Incorrect", "{start_date} → 201; {answer:'confirm'|'not_yet'|'incorrect', start_date?} → 200 application (`hired`, `hire_start_date`, `feedback_opens_on` after Confirm); one open report (409 `HIRING_REPORT_PENDING`)"],
  ["Core", "GET", "/api/applications/{id}/feedback-form", "Accommodations to rate (those advertised when the hire was confirmed)", "→ {opens_on, is_open, submitted, items:[{accommodation_id,name}]}"],
  ["Core", "POST", "/api/applications/{id}/feedback", "Submit per-accommodation feedback", "{items:[{accommodation_id,rating}],comments} → 201"],
  ["Core", "GET", "/api/employers/{id}/trust-score", "Score, count and breakdown (breakdown empty until published)", "→ {published, score, based_on, breakdown[]}"],
  ["Core", "GET", "/api/admin/employers, /api/admin/employers/{id}", "Verification queue; one employer with its latest registry check", "→ AdminEmployer"],
  ["Core", "PATCH", "/api/admin/employers/{id}/verify", "Run registry check, approve or reject", "{action:'check'|'approve'|'reject', reason} → 200 {registry, verified_at}"],
  ["Core", "GET, POST, PUT, DELETE", "/api/admin/categories, /api/admin/accommodations", "Manage master data", "→ category / accommodation"],
  ["Core", "GET", "/api/candidate/dashboard, /api/employer/dashboard, /api/admin/dashboard", "Role summaries (M8); counts equal the lists they link to", "→ zero-filled counts per stage, matching jobs, ratings due, trust score, queues; employer also `attention`, `recent_activity`, 12 `weeks`; admin also `analytics` for the charts (weeks, stage funnel, needs vs offers, delivery)"],
  ["Core", "GET, PATCH", "/api/notifications, /api/notifications/{id}/read, /api/notifications/read-all", "In-app notices for candidates and employers (M9)", "→ {data:[{id,type,data:{message,url},read_at}], meta:{unread_count}}"],
  ["Core", "POST; GET, PATCH", "/api/job-postings/{id}/reports; /api/admin/reports/{id}", "Report a visible posting; admin dismisses or records action (M10)", "{reason} → 201; {status:'dismissed'|'actioned', note} → 200"],
  ["Core", "DELETE", "/api/admin/job-postings/{id}", "Remove a posting in any status, e.g. after a report (M4/M10)", "{reason} → 204; soft delete, applications kept; employer gets a notice with the reason"],
  ["Core", "PATCH", "/api/admin/users/{id}/suspend", "Suspend (revokes all tokens, hides an employer's postings) or reactivate (M10)", "{suspended:true|false} → 200 user; own account → 422"],
  ["Core", "GET; POST, DELETE", "/api/candidate/saved-jobs; /api/candidate/saved-jobs/{jobId}", "Bookmarks of visible postings (M12)", "→ {data:[posting+saved], meta}; POST 201 (200 if already saved); DELETE 204"],
  ["Core (internal)", "GET", "/internal/job-postings/{id}/summary", "Posting data for the Insights Service (not routed by gateway)", "X-Service-Key → {address, psgc_code, location_label, accommodations, trust_score}"],
  ["Insights (internal)", "GET", "/internal/places/{code}", "City-centre point, province and region of a PSGC place for the Core Service (not routed by gateway)", "X-Service-Key → {code, city, province, region, lat, lon, precision}; unknown 404, PSGC down 503"],
  ["Insights", "GET", "/api/insights/job-postings/{id}", "Workplace Accessibility Snapshot (mashup)", "→ 200 snapshot (Section 4.5); 404 posting not visible; 503 Core unreachable"],
  ["Insights", "GET", "/api/insights/locations/{level}", "Normalized PSGC lists (regions, provinces, cities/municipalities)", "?parent=<10-digit PSGC code> → [{code,name,level}]; header `X-Data-Source`"],
  ["Registry (SOAP)", "POST", "/soap  (SOAPAction: VerifyBusinessRegistration)", "Legacy registry lookup (internal only)", "SOAP envelope → SOAP response / Fault (Section 4.3)"],
], [1250, 950, 2700, 2280, 2900], { size: 16 }));

C.push(H2("4.2 JSON Representation"));
C.push(P("**Search with matching** – `GET /api/job-postings?match=1&q=encoder&page=1` (candidate token). The `match` object is computed by the Core Service from the candidate's profile and needs; it appears for logged-in candidates with a profile."));
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
      "skills": [ "Data entry", "Microsoft Excel" ],
      "education_level": "senior_high", "experience_years": 1,
      "salary": { "min": 18000, "max": 22000, "period": "month", "currency": "PHP" },
      "accommodations": [
        { "id": 1, "name": "Wheelchair-accessible entrance", "group": "physical_access",
          "note": "Ramp at main entrance; restroom on 2nd floor via elevator" },
        { "id": 9, "name": "Flexible hours", "group": "work_arrangement", "note": null }
      ],
      "match": { "score": 74, "label": "good",
                 "met": 4, "total": 5, "missing": [ { "id": 6, "name": "Sign language interpreter" } ],
                 "skills": { "matched": [ "Data entry" ], "missing": [ "Microsoft Excel" ] },
                 "location": { "tier": "same_city", "distance_km": 2.4 },
                 "education": { "required": "senior_high", "met": true },
                 "experience": { "required_years": 1, "met": false },
                 "preferences": { "work_setup": true, "employment_type": true } },
      "saved": false,
      "trust_score": { "published": true, "score": 86, "based_on": 5 }
    }
  ],
  "meta": { "current_page": 1, "per_page": 12, "total": 12, "match_mode": true, "distance": null }
}`));
C.push(P("Important fields: `match.score` (0–100) and `label` drive the \"Match: 74% · Good match\" line and the ranking; the parts (`skills`, `location`, `education`, `experience`, `preferences`) explain \"Why this match?\"; `met`/`total` count the accommodation needs the posting offers and `missing` names the unmet ones; `salary` is null when the employer does not disclose it; `saved` (logged-in candidates only) drives the Save button on each result; `trust_score.published` is false (and `score` null) until three feedback responses exist; `location.psgc_code` is the official 10-digit PSGC code chosen in the location picker (the label is stored with it) and is used by the Insights Service."));
C.push(P("**Apply** – `POST /api/job-postings/42/applications`. The candidate's profile must be complete and a résumé must be on file (422 `PROFILE_INCOMPLETE` or `RESUME_REQUIRED`; the Apply form offers a résumé upload when there is none)."));
C.push(...code(`
Request:  { "cover_note": "I have 3 years of encoding experience.",
            "interview_request": "Please provide a captioned online interview." }

Response 201:
{ "id": 318, "job_posting_id": 42, "status": "pending",
  "created_at": "2026-10-02T09:15:04+08:00" }`));
C.push(P("**Hiring confirmation** – the employer reports the hire with the first working day (`POST /api/applications/318/hiring-reports`); the candidate answers (`POST /api/applications/318/hiring-reports/12/response`). A candidate can also report first; then the employer answers. Only the other party can answer (the reporter gets 403), and a second open report gets 409 `HIRING_REPORT_PENDING`."));
C.push(...code(`
Employer:  { "start_date": "2026-10-30" }
Response 201: { "id": 318, "status": "contacted",
  "hiring_reports": [ { "id": 12, "reported_by": "employer", "start_date": "2026-10-30",
      "status": "pending", "can_respond": false,
      "events": [ { "actor_role": "employer", "action": "reported", "start_date": "2026-10-30",
                    "created_at": "2026-10-23T22:44:12+08:00" } ] } ] }

Candidate: { "answer": "confirm" }          (or "not_yet" with an optional new start_date, or "incorrect")
Response 200: { "id": 318, "status": "hired", "hired_at": "2026-10-23T22:44:20+08:00",
  "hire_start_date": "2026-10-30", "feedback_opens_on": "2026-11-29", ... }`));
C.push(P("**Submit feedback** – `POST /api/applications/318/feedback` (only when status is `hired`, from calendar day 30 after the confirmed start date in Asia/Manila time – e.g. start date 1 October, feedback opens on 31 October; one per application). The items are the accommodations the posting advertised when the hire was confirmed – the Core Service records them then in `application_accommodation`, so later edits to the posting do not change what is rated – and every item must be rated once. Ratings map to Delivered = 1, Partially = 0.5, Not delivered = 0. The candidate's own application view adds `feedback_submitted`; employers never see whether or how a candidate rated."));
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
Host: business-registry-soap.railway.internal:8003
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
C.push(P("A second transformation happens inside the Core Service: the **matching engine** (`MatchingService`) scores every posting left after the filters for the logged-in candidate. Five parts are weighted: **skills 40** (the posting's required skills the candidate has, compared through the shared skills list and its aliases, ignoring case), **location 20** (remote or same city counts fully, same province 60%, same region 30%), **qualifications 15** (minimum education level and years of experience), **work preferences 10** (work setup and employment type) and **accommodation needs 15** (the share of the candidate's needs the posting offers – only when needs are saved). A part without data on either side is left out and the others re-weighted, so the score stays between 0 and 100; labels are Strong (≥ 80), Good (≥ 60), Fair (≥ 40) and Low. \"Recommended for me\" orders by score, then by the chosen sort (newest or closing soon). The filters run first in SQL: keyword (title, description, company), category, accommodations (a posting must offer every selected one), work setup, and distance – 10, 25, 50 or 100 km between the candidate's and the workplace's city centres (an equirectangular approximation computed in the query; remote jobs are always kept). Disability type is never used. The **trust score** transformation converts ratings to values (Delivered = 1, Partially = 0.5, Not delivered = 0) and computes Σ item ratings ÷ number of rated items × 100, rounded to a whole percentage (e.g. 86%)."));

// ---------- 5 Integration flow ----------
C.push(H1("5. Integration Flow"));
C.push(H2("5.1 Core Transaction Sequence"));
C.push(...fig("fig3_sequence_match_apply.png", 2200, 1520, "Sequence – a candidate opens a matched job, receives the Accessibility Snapshot and applies"));
C.push(...fig("fig7_sequence_hire_feedback.png", 2200, 1639, "Sequence – the employer reports a hire, the candidate confirms it, and from day 30 after the start date the candidate's ratings update the trust score"));
C.push(...fig("fig4_sequence_verify.png", 2200, 1240, "Sequence – an administrator verifies an employer through the legacy SOAP Business Registry"));
C.push(H2("5.2 Service-to-Service Integrations"));
C.push(...table(["Source", "Destination", "Trigger / Endpoint", "Data Exchanged", "Expected Result"], [
  ["React SPA", "API Gateway", "Any `/api/*` call (HTTPS)", "JSON body, Bearer token", "Request routed with `X-Request-ID`; uniform error format on failure"],
  ["API Gateway", "Core Service", "`/api/*` (except insights) via `http://core-api.railway.internal:8001`", "Original request + `X-Request-ID`, `X-Forwarded-For`", "Core response passed back unchanged; 504 `UPSTREAM_TIMEOUT` after 10 s"],
  ["API Gateway", "Insights Service", "`/api/insights/*` via `http://insights-service.railway.internal:8002`", "Original request + `X-Request-ID`", "Snapshot or location list; 504 after 15 s"],
  ["Insights Service", "Core Service", "`GET /internal/job-postings/{id}/summary` with `X-Service-Key`", "Address, PSGC code and label, accommodations, trust score with breakdown", "200 summary (never cached); 404 if posting is not open/approved → snapshot 404; any other failure → snapshot 503"],
  ["Core Service", "Insights Service", "`GET /internal/places/{code}` with `X-Service-Key` when a profile's or posting's PSGC location changes; `locations:resolve` every 15 minutes for points still missing", "PSGC code → city, province, region and city-centre latitude/longitude", "Point stored on the profile or posting for the distance filter (the province also refines the location part of the match score); 4-second timeout, a failure never blocks saving"],
  ["Core Service", "Business Registry (legacy)", "SOAP `VerifyBusinessRegistration` on `PATCH /api/admin/employers/{id}/verify` (`action=check`)", "Registration number, registry type, business name; WS-Security UsernameToken", "Registry status and name-match score stored in `registry_checks`"],
  ["Insights Service", "Nominatim (external)", "`GET /search?q=&countrycodes=ph&format=jsonv2&limit=1` (city searches `limit=5`); `User-Agent` with contact email", "Street address and PSGC place names → lat/lon", "Coordinates cached 30 days (key: SHA-256 of the normalized query)"],
  ["Insights Service", "Overpass (external)", "`POST /api/interpreter` (Overpass QL, `around:500`) on the main server; the second server after 5 s or a failure", "Coordinates → OSM elements with `wheelchair` tag", "Nearby accessible places cached 24 h; a failed place is retried in the background"],
  ["Insights Service", "PSGC API (external)", "`GET /regions`, `/regions/{code}/provinces`, `/regions/{code}/cities-municipalities` (NCR), `/provinces/{code}/cities-municipalities`", "PSGC codes and names", "Normalized location lists (10-digit codes, sorted by name) cached 7 days"],
  ["Core Service", "Core Service (event)", "Application stage change; hiring report or answer; admin decision on an employer's verification or removal of a posting; feedback saved/hidden (observer)", "Application, report and start date, decision and reason, feedback items", "In-app notification created (`application_received`, `application_status_changed`, `hiring_report`, `employer_verification`, `posting_review`); employer trust score and feedback count recalculated"],
  ["Core scheduler (in the Core container)", "Core Service (commands)", "Daily 00:05 `postings:close-expired`; daily 08:00 `feedback:remind`; every minute the database queue worker; every 15 minutes `locations:resolve`", "Postings past their closing date; hired applications whose rating opens (day 30 after the start date); queued reset-link jobs; locations without a point", "Postings closed; `feedback_reminder` notice to the hired candidate (once); password-reset emails sent within about a minute; missing city-centre points filled"],
  ["Core Service", "Brevo email API (external, HTTPS)", "Every in-app notice of a user whose emails are on (sent after the HTTP response); `POST /api/forgot-password` (queued job)", "Subject, the notice text and a link to the page in OpenDoor – never disability or accommodation-need details; the reset link", "Email delivered; a mail failure is logged and never fails the user's action; suspended accounts get no email"],
], [1500, 1600, 2600, 2180, 2200], { size: 16 }));
C.push(H2("5.3 Error Handling and Status Propagation"));
C.push(P("Every service returns the error envelope shown in Section 4.2. The gateway creates an `X-Request-ID` (UUID) if the client did not send one, forwards it to every downstream call, and logs it, so one request can be traced through all services. Downstream status codes are propagated unchanged to the client; the gateway only generates its own errors when a dependency cannot be reached."));
C.push(...table(["HTTP", "Application Error Code", "Raised by", "When / Behavior"], [
  ["400", "BAD_REQUEST", "Core", "A request the framework rejects as malformed. A malformed JSON body is read as empty and answered with 422 `VALIDATION_FAILED` (never a stack trace)"],
  ["401", "UNAUTHENTICATED", "Core", "Missing, invalid or revoked Sanctum token (also every token of a suspended account); the client logs the user out"],
  ["403", "FORBIDDEN / ACCOUNT_SUSPENDED", "Core", "Wrong role or Policy denies (e.g., editing another employer's posting, reading another candidate's application); login to a suspended account"],
  ["404", "NOT_FOUND", "Core, Insights", "Unknown ID; a posting that is not open, or whose employer is not verified or is suspended (also when saving, applying or reporting); unknown PSGC region/province or place"],
  ["409", "ALREADY_APPLIED / FEEDBACK_EXISTS", "Core", "Duplicate application or second feedback for the same application"],
  ["409", "HIRING_REPORT_PENDING / HIRING_REPORT_CLOSED", "Core", "A second hiring report while one is waiting for an answer; answering a report that was already answered or cancelled"],
  ["422", "VALIDATION_FAILED", "Core, Insights", "Form Request validation fails, or a location list `parent` that is not a 10-digit PSGC code; also business checks reported per field: a second open report on the same posting (`errors.reason`), an administrator suspending their own account (`errors.suspended`); field errors returned in `errors`"],
  ["422", "INVALID_STATUS_TRANSITION", "Core", "Transition not allowed by the ApplicationStatus enum (e.g., Not selected → Shortlisted, a stage moving backward, or setting Hired directly – a hire needs a confirmed hiring report)"],
  ["422", "PROFILE_INCOMPLETE / RESUME_REQUIRED", "Core", "Applying without a complete profile (location, at least three skills, education level, work preferences) or without a résumé on file"],
  ["422", "POSTING_CLOSED / FEEDBACK_NOT_OPEN", "Core", "Applying to a closed posting; feedback before calendar day 30 after the confirmed start date (Asia/Manila)"],
  ["422", "REGISTRY_INVALID_REQUEST", "Core", "Registry returned `Client.Validation` (e.g., malformed registration number); the employer is asked to correct it"],
  ["429", "RATE_LIMITED", "Gateway, Core", "Over 120 requests/min per IP at the gateway, or over 5 login or password-reset requests/min; `Retry-After` header sent"],
  ["500", "SERVER_ERROR", "Core", "Unexpected server error; generic message only (no stack trace), details logged with the `request_id`"],
  ["502", "REGISTRY_UNAVAILABLE / REGISTRY_AUTH_FAILED", "Core", "`Server` / `Client.Authentication` fault, connection failure or 5-second timeout; employer remains in the manual review queue"],
  ["502", "UPSTREAM_ERROR", "Gateway", "Downstream service refused the connection or returned an invalid response"],
  ["503", "SERVICE_UNAVAILABLE", "Gateway, Insights", "Gateway: target service down (e.g., sleeping free-tier instance). Insights: Core Service unreachable for a snapshot, or a PSGC list neither cached nor bundled"],
  ["504", "UPSTREAM_TIMEOUT", "Gateway", "Core > 10 s, Insights > 15 s"],
], [800, 3000, 1500, 4780], { size: 16 }));
C.push(P("**Graceful degradation.** External and legacy integrations never block the core hiring transaction. The Insights Service uses per-source timeouts (Core 3 s, PSGC 5 s, Nominatim 5 s, Overpass 25 s per server with the second server asked after 5 s) within a 12-second budget for the whole snapshot – a later Overpass answer still fills the cache – returns HTTP 200 with whatever parts it could build, and reports each source as `ok`, `cached`, `stale` or `unavailable`. A source that failed is skipped for 60 seconds (cooldown), so during an outage each request waits for at most one timeout and is answered from the cache. The client explains each gap in plain language (for example \"Nearby places could not be loaded right now. Please check again later.\" or, with city-level coordinates, that distances are measured from the city centre). If the snapshot fails (503) or the Insights Service itself is down, the job details page still renders the posting, match result and trust score from the Core Service and the snapshot section shows a short warning. If the Business Registry is down, administrators can still verify manually and the check can be repeated. The gateway and the Core Service never retry a call automatically; the user or administrator repeats the action. The only automatic retries are in the Insights Service for Overpass (second server, background refresh of a failed place), because they only refresh cached map data and change nothing in the hiring records, and the Core Service's 15-minute job that fills city-centre points the Insights Service could not supply when a location was saved (until then such a posting is left out of distance searches – remote jobs are always kept – and a candidate without a point gets no distance filter; the location part of the match score uses the PSGC codes and is not affected). Notification emails are sent after the response, so a slow or failing mail server never delays or breaks the action."));

// ---------- 6 Security ----------
C.push(H1("6. Security Design"));
C.push(H2("6.1 Authentication"));
C.push(...bullets([
  "**Users** log in with email and password through `POST /api/login`. Passwords are hashed with bcrypt. The Core Service issues a **Laravel Sanctum personal access token**, which the React client sends as `Authorization: Bearer <token>` on each request through the gateway. Logout revokes the token on the server. Suspended accounts cannot log in and all their tokens are revoked at once; while an employer is suspended its postings are hidden from candidates and guests (nothing is deleted, so reactivation restores them).",
  "**Forgotten passwords:** `POST /api/forgot-password` gives the same answer for every email and only queues a job, so neither the message nor the response time reveals whether an account exists (an OpenDoor account hints at a disability – RA 10173). The job emails a link to active accounts only; the link is valid for 60 minutes and can be used once, the reset signs the user out on every device, and both endpoints allow 5 requests per minute. The reset email is a security message, so it is sent even when notification emails are turned off.",
  "**Administrators** are never self-registered; they are created by the seeder or by another administrator.",
  "**Gateway → services:** the gateway forwards the bearer token unchanged; the Core Service validates it (the gateway does not trust or decode it).",
  "**Insights ↔ Core (service-to-service):** internal endpoints under `/internal/*` – Core's posting summary and Insights' place lookup – are not routed by the gateway and require an `X-Service-Key` header whose value is a shared secret held only by the two services; requests without it receive 401.",
  "**Core → Business Registry (legacy):** a WS-Security `UsernameToken` in the SOAP header identifies the Core Service; the registry rejects missing or wrong credentials with a SOAP fault.",
]));
C.push(H2("6.2 Authorization"));
C.push(P("Authorization is enforced on the server in three layers: (1) `auth:sanctum` middleware requires a valid token; (2) a **role middleware** restricts route groups to `candidate`, `employer` or `admin`; and (3) **Laravel Policies** (`JobPostingPolicy`; `ApplicationPolicy` for viewing, stage changes, hiring reports and feedback) check ownership of the specific record – for example, an employer can update only its own postings and can see a candidate's accommodation needs only through an application to its own posting; only a verified company can publish; a hiring report can be answered only by the other party of that application; and only the hired candidate can submit feedback. API Resources control which fields each role receives (feedback authors are never exposed to employers). The React `ProtectedRoute` component only improves navigation; the server is the real protection. The full permission matrix is reproduced in Appendix A."));
C.push(P("**OAuth 2.0** is not used in this version: all users authenticate directly with OpenDoor, and the external APIs used require no delegated access. A delegated-authorization scenario (e.g., \"Sign in with Google\" or letting a candidate import a résumé from a third-party service) is listed as a future improvement."));
C.push(H2("6.3 Secret and Credential Management"));
C.push(...bullets([
  "All secrets are environment variables: `APP_KEY`, `DB_*`, `SERVICE_KEY_INSIGHTS`, `REGISTRY_SOAP_USER/PASSWORD`, `BREVO_API_KEY` and `MAIL_FROM_ADDRESS` (email), `NOMINATIM_CONTACT_EMAIL`, `DEMO_PASSWORD`; settings such as `CORS_ALLOWED_ORIGIN` and `VITE_API_URL` use the same mechanism.",
  "Each component has a committed `.env.example` with placeholder values only; real `.env` files are listed in `.gitignore` and are never committed.",
  "Production values are stored in **Railway service variables** and **Vercel environment variables**. The CI integration job generates throwaway secrets (database passwords, service key, SOAP password, demo password) at the start of every run, so no secret is stored in GitHub. The production values (`APP_KEY`, database passwords, service key, SOAP password) were generated fresh for the deployment, differ from development and were entered through the Railway API without being printed or committed; the database users were created over Railway's SSH access to the MySQL container, so the database has no public port. After Railway's security incident of October 2026 every production secret – including the Brevo key and the demo password – was replaced on 25 October 2026 (Section 8.2).",
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
  "**Data privacy (RA 10173):** explicit consent is recorded (`consented_at`) before accommodation data is stored; disability type is optional, hidden by default and never used for matching; candidates' needs are shown to an employer only after the candidate applies; trust scores and their per-accommodation breakdown are aggregated and shown only after three responses so individual employees cannot be identified; notification emails state only what happened and link to OpenDoor – never disability or needs details – and can be turned off in Account settings; Read aloud runs entirely in the browser, and Voice input is never on by default and explains before first use that Chrome and Edge send the audio to their speech service; the résumé text is read only to suggest skills and is never stored or logged.",
  "**Project-specific risks:** fake employers (mitigated by registry check, Verified badge and publishing only for verified companies), fake hires to collect or block ratings (a hire needs both parties' confirmation, and every report and answer is kept), retaliation for negative feedback (anonymity and three-response threshold), false accommodation claims (report-a-posting and moderation), and dependence on third-party APIs (caching, timeouts, degraded mode).",
]));

// ---------- 7 Testing ----------
C.push(H1("7. Testing and Quality Assurance"));
C.push(H2("7.1 Functional and Integration Test Plan"));
C.push(...table(["Test ID", "Scenario", "Type", "Expected Result", "Actual Result", "Status"], [
  ["T01", "Register candidate with consent, then log in", "Functional", "201 then 200 with token and `role=candidate`", "201 with token and `role=candidate`; log-in 200 with the same role", "PASS"],
  ["T02", "Verified employer creates a posting with 3 accommodations and notes, skills and salary", "Functional", "201; posting `status=open` (published at once), 3 accommodations, skills and job details stored", "201; `status=open`; skills stored under their list names; salary range per month, responsibilities and schedule stored; 3 accommodations with their notes; JobPosting schema matched", "PASS"],
  ["T03", "Demo candidate (complete profile, 3 needs) opens \"Recommended for me\" (`match=1`)", "Functional", "200; postings ordered by `match.score` desc; labels follow the score; `missing` lists unmet needs", "200; `match_mode=true`, 12 per page, only open postings; every posting has a Match object; ranked by score; labels follow the score; `missing` = total − met; the details page returns the score, its parts and the missing needs by name", "PASS"],
  ["T04", "Candidate (complete profile, résumé) applies to an open posting", "Functional", "201 `status=pending`; employer receives notification", "201 `status=pending`; the employer's newest notice is `application_received` for this application and is counted as unread", "PASS"],
  ["T05", "Candidate applies to the same posting twice", "Negative", "409 `ALREADY_APPLIED`", "409 `ALREADY_APPLIED`; `request_id` equals the `X-Request-ID` header", "PASS"],
  ["T06", "Employer sets `hired` directly through the status endpoint", "Negative", "422 `INVALID_STATUS_TRANSITION` (a hire needs a confirmed hiring report)", "422 `INVALID_STATUS_TRANSITION` (\"An application becomes hired only when both parties confirm a hiring report.\")", "PASS"],
  ["T07", "GET `/api/job-postings/999999` (invalid ID)", "Negative", "404 `NOT_FOUND` with `request_id`", "404 `NOT_FOUND`; `request_id` equals the `X-Request-ID` header", "PASS"],
  ["T08", "Employer A updates Employer B's posting", "Negative (security)", "403 `FORBIDDEN`", "403 `FORBIDDEN`", "PASS"],
  ["T09", "Request without token to `/api/applications`", "Negative (security)", "401 `UNAUTHENTICATED`", "401 `UNAUTHENTICATED`", "PASS"],
  ["T10", "Hired candidate (confirmed hire, start date 45 days ago) submits feedback; 3rd response for the employer", "Functional", "201; trust score published with `based_on=3` and correct value", "201 (3 items rated); trust score `published=true`, `based_on=3`, `score=78`; breakdown with 3 ratings per accommodation", "PASS"],
  ["T11", "Feedback before day 30 after the confirmed start date", "Negative", "422 `FEEDBACK_NOT_OPEN`", "422 `FEEDBACK_NOT_OPEN` (\"Feedback opens on 2026-11-22, 30 days after your confirmed start date.\")", "PASS"],
  ["T12", "Get Accessibility Snapshot (Gateway → Insights → Core → Nominatim/Overpass/PSGC)", "Integration", "200 within 15 s; `location` has the PSGC code, label and coordinates in the Philippines (`precision` street or city); `sources.core=ok`", "200 in 12 s (within 15 s); code `1381300000` with its label, lat 14.651 / lon 121.049, `precision=city`; `core=ok`, PSGC and Nominatim `cached`, Overpass `unavailable` with `nearby_accessible=null` – both public Overpass servers timed out that day, and the snapshot degraded as designed (live APIs on 7 Oct 2026: every source `ok`, 3.7 s)", "PASS"],
  ["T13", "Snapshot with Overpass unreachable (invalid `OVERPASS_URL` in test env)", "Integration (degradation)", "200; `sources.overpass=unavailable` and `nearby_accessible=null` (`cached`/`stale` if a cached result exists); location and employer claims present", "200 in 77 ms; location, employer claims and trust score present; `overpass=unavailable`, `nearby_accessible=null` (Insights restarted without its cache database)", "PASS"],
  ["T14", "Admin registry check for a seeded ACTIVE SEC number", "Integration (SOAP)", "200; `registry.status=ACTIVE`; `name_match ≥ 0.80`; check stored", "200; `ACTIVE`, registered name \"KALINGA FOODS, INC.\", `name_match=1`; check stored and shown on the employer; employer not approved by the check", "PASS"],
  ["T15", "Registry check with an unknown number / wrong SOAP password", "Integration (negative)", "200 `status=NOT_FOUND` / 502 `REGISTRY_AUTH_FAILED`", "Unknown DTI number: 200 `NOT_FOUND`, no name or score. Wrong SOAP password: 502 `REGISTRY_AUTH_FAILED` (Core feature test; the run cannot change the registry password)", "PASS"],
  ["T16", "Call Core `/internal/job-postings/{id}/summary` without `X-Service-Key`", "Integration (security)", "401 `UNAUTHENTICATED`; the gateway does not route `/internal/*`", "401 `UNAUTHENTICATED` (\"A valid service key is required.\"); the gateway answers 404 for `/internal/*`", "PASS"],
], [560, 2000, 1050, 2350, 3420, 700], { size: 16 }));
C.push(P("**Results** come from the final test run of 23 October 2026 on commit `7548904`: Newman through the gateway against the whole stack running locally (Windows 11, natively) on a freshly seeded test database, with the live PSGC, Nominatim and Overpass APIs. All 16 tests passed. The CI run of the deployed code (GitHub Actions run 40182232704 of 25 October 2026, all seven jobs, with the external APIs replaced by the mock server) passed every assertion: 216 requests, 1,065 assertions, 0 failed; T13 15 / 87 / 0; axe 33 pages, 0 violations. The earlier CI run 38493807232 of 14 October 2026 had also passed all 16."));
C.push(P("Each test ID is the prefix of at least one request name in the Postman collection (e.g. `T05 Applying again → 409 ALREADY_APPLIED`), so a Newman report shows the result per test. Folder 09 adds further security cases beyond the plan: a forged token, other roles and other employers denied (403), a candidate or employer reading someone else's application (403), an administrator suspending their own account (422), SQL-like search text treated as plain text, malformed JSON answered without a stack trace, no CORS headers for an unknown origin, no `X-Powered-By` header, and the suspension rule end to end (token revoked, login refused, postings hidden, restored on reactivation)."));
C.push(H2("7.2 Postman / API Test Evidence"));
C.push(P("The repository contains `tests/postman/OpenDoor.postman_collection.json` and environments `local.postman_environment.json` and `production.postman_environment.json` (variables: `baseUrl`, `candidateEmail`, `employerEmail`, `adminEmail`, passwords from secrets). The collection is organized in folders that run in order: **01 Auth**, **02 Master Data**, **03 Employer & Postings**, **04 Candidate & Matching**, **05 Applications & Status**, **06 Feedback & Trust Score**, **07 Insights Mashup**, **08 Admin & SOAP Registry**, **09 Negative & Security Cases**. Login requests save tokens to collection variables; create requests save IDs (`jobPostingId`, `applicationId`) for later requests."));
C.push(P("Assertions written in each request's Tests tab check:"));
C.push(...bullets([
  "**Status codes** – e.g., `pm.response.to.have.status(201)` for create, 409/422/403/401/404 for negative cases.",
  "**Identifiers** – returned `id` is a number and equals the saved `applicationId`; `job_posting_id` matches the request.",
  "**Business values** – `status` equals `pending` after apply; `match.met <= match.total`; results sorted by `match.met` descending; `trust_score.published` is false with fewer than three responses and true with `based_on >= 3`.",
  "**Application errors** – `error.code` equals the expected code (`ALREADY_APPLIED`, `INVALID_STATUS_TRANSITION`, …) and `error.request_id` exists.",
  "**Schema and timing** – key responses validated against JSON schemas written to follow `docs/openapi.yaml` (`pm.expect(body).to.be.jsonSchema(...)`, e.g. \"matches the JobPosting shape\"); response time under 1,000 ms for non-mashup endpoints and under the gateway timeout (15 s) for the snapshot.",
]));
C.push(P("The collection (217 requests) runs headless with `newman run tests/postman/OpenDoor.postman_collection.json -e <env> --reporters cli,htmlextra`, once in full and once more for folder 07 with Overpass unreachable (T13 runs only in that second pass). Results of the final run of 23 October 2026 (local stack, freshly seeded test database, live external APIs):"));
C.push(...table(["Newman run", "Requests", "Assertions", "Failed", "Duration", "Average response"], [
  ["Full collection (folders 01–09)", "216", "1,065", "1", "70.7 s", "229 ms"],
  ["Folder 07 with Overpass unreachable (T12, T13, T16)", "15", "87", "0", "3.9 s", "167 ms"],
], [3600, 1100, 1200, 900, 1200, 2080]));
C.push(P("The one failed assertion is a timing check, not a functional one: \"Snapshot again → PSGC, Nominatim and Overpass are not asked again\" expects the second snapshot within 1,000 ms. Both public Overpass servers timed out that day (`overpass-api.de` aborted, the second server did not answer), so the first snapshot used its full 12-second budget and the second request waited for the same Overpass request, which was still running. Every functional check of both snapshots passed: HTTP 200, `overpass: unavailable`, `nearby_accessible: null`, no source fetched again. The longer average response time comes from these two 12-second snapshots. With the mock APIs in CI the same check passed (run 38493807232: 193 requests, 933 assertions, 0 failed)."));
C.push(...fig("screens/newman-summary.png", 1350, 675, "Newman HTML report (htmlextra) of the full collection, final run of 23 October 2026"));
C.push(P("The unit and feature tests of the same day all passed: Core Service 506 PHPUnit tests (2,247 assertions), run on SQLite and again on MySQL 8, React 197 Vitest tests, gateway 24 and Insights Service 141 Jest tests, Business Registry 39 checks; the axe check found no WCAG 2.1 A/AA violations on 33 pages. Core's routes were compared with `docs/openapi.yaml`: every Core operation is documented (the only extra is Laravel's automatic PATCH alias of two documented PUT endpoints)."));
C.push(P("**Production smoke test.** The full collection creates and deletes data (a throwaway candidate, postings, an application, a rating), so it is not run against the deployed system. `node tests/postman/build-smoke.mjs` derives a read-only subset from the generated collection: GET requests, the demo logins and requests the API must refuse (401/403/404/422), without any request that needs data created by a write. It ran against the production gateway after the first release (16 October 2026) and again after the release of 25 October 2026 and the rotation of all production secrets (the subset grew to 80 requests with the new endpoints):"));
C.push(...table(["Newman run", "Requests", "Assertions", "Failed", "Duration", "Average response"], [
  ["Production smoke, release of 25 Oct 2026 (Railway, from a laptop in the Philippines)", "80", "435", "0", "17.5 s", "138 ms"],
  ["Production smoke, release of 16 Oct 2026", "73", "389", "0", "18.4 s", "170 ms"],
], [3600, 1100, 1200, 900, 1200, 2080]));
C.push(H2("7.3 Load / Stress Testing"));
C.push(...table(["Item", "Details"], [
  ["Target component", "API Gateway → Core Service: `GET /api/job-postings?match=1&page=1` (candidate token; matching query with `withCount`), plus `GET /api/job-postings/{id}` as a secondary sampler"],
  ["Tool", "Apache JMeter 5.6.3 (one test plan `tests/jmeter/opendoor-matching.jmx`, host and load set with `-J` properties), run in CLI mode: `jmeter -n -t opendoor-matching.jmx -Jhost=<gateway> -Jthreads=50 -Jloops=10 -l results.jtl -e -o report/`"],
  ["Workload", "Thread Group: 50 users, ramp-up 60 s, 10 loops each (500 search requests + 500 detail requests); CSV Data Set with 50 candidate tokens. Test data comes from `php artisan load-test:data` (not a seeder): 500 open postings from 10 verified load-test companies and 50 load-test candidates with accommodation needs (from the 18 seeded accommodation types), one token each; `--remove` deletes it all afterwards. A stress step repeats with 100 and 200 users (5 loops). The gateway limit of 120 requests/min per IP is raised for the test window only. Because the 60 s ramp-up let each user finish before most others had started, every profile was repeated with a 5 s ramp-up (\"burst\") so that all users ran at the same time."],
  ["Metrics", "Average and median response time, 95th percentile (P95), throughput (requests/s), error rate (%); targets: P95 < 1,500 ms and error rate < 1% at 50 users"],
  ["Observed result", "Production run on 16 October 2026 (Railway Free Trial, Singapore; JMeter on a laptop in the Philippines): every one of the 8,000 requests returned 200 and passed all assertions – 0% errors in all six runs. 50 users at the same time: median 500 ms, P95 748 ms, 72 requests/s; 100 users: P95 1,333 ms, 78 requests/s; 200 users: P95 2,838 ms (longest request 2,997 ms), 81 requests/s. With the documented 60 s ramp-up at most 8 users were active at once, and P95 stayed between 204 and 222 ms (table below)."],
  ["Interpretation", "The target is met: P95 is 748 ms with 50 concurrent users (and 204 ms in the documented profile) with no errors, and it still holds at 100 concurrent users. The limit is throughput: it levels off at about 80 requests/s, so above that, response times grow with the number of users – at 200 concurrent users P95 is 2.8 s, nearly twice the target, although no request failed or timed out. The bottleneck is a single Core Service instance on the trial's shared vCPU (each search ranks every open posting by needs met); more Core instances or a larger plan would raise it. Limitations: one client machine on a home connection, trial-tier instances, one MySQL server shared by both schemas, and a 500-posting catalogue, so the numbers show behaviour under load rather than production capacity."],
], [2400, 7680], { kv: true }));
C.push(...table(["Run (16 Oct 2026)", "Users at once", "Requests", "Errors", "Median", "P95", "Throughput"], [
  ["Load – 50 users, 60 s ramp-up, 10 loops", "≤ 3", "1,000", "0%", "98 ms", "204 ms", "16.4/s"],
  ["Stress – 100 users, 60 s ramp-up, 5 loops", "≤ 4", "1,000", "0%", "98 ms", "222 ms", "16.6/s"],
  ["Stress – 200 users, 60 s ramp-up, 5 loops", "≤ 8", "2,000", "0%", "98 ms", "220 ms", "33.1/s"],
  ["Burst – 50 users, 5 s ramp-up, 10 loops", "50", "1,000", "0%", "500 ms", "748 ms", "72.4/s"],
  ["Burst – 100 users, 5 s ramp-up, 5 loops", "100", "1,000", "0%", "909 ms", "1,333 ms", "77.5/s"],
  ["Burst – 200 users, 5 s ramp-up, 5 loops", "200", "2,000", "0%", "2,010 ms", "2,838 ms", "81.3/s"],
], [3100, 1100, 1100, 900, 1100, 1100, 1680], { size: 16 }));
C.push(...fig("screens/jmeter-burst-50.png", 1110, 769, "JMeter dashboard, Response Times Over Time (1 s granularity): 50 users at the same time – search and details stay below 800 ms on average"));
C.push(H2("7.4 Defects and Corrections"));
C.push(P("Defects that actually occurred during development – most of them integration defects – found in live checks through the gateway, in the MySQL test runs, in CI or in dependency audits, and how each was corrected (dates are in the repository's commit history and `PROGRESS.md`):"));
C.push(...table(["ID", "Defect", "Cause", "Correction", "Verified by"], [
  ["D01", "Any website could call the API: responses through the gateway carried `Access-Control-Allow-Origin: *` (4 Oct 2026)", "Laravel's default CORS middleware answered with `*`, and the gateway passed upstream headers through", "The gateway removes the services' CORS headers and sets its own for the frontend origin only", "Gateway Jest tests; folder 09 \"unknown origin gets no CORS header\""],
  ["D02", "Responses revealed the server stack: `X-Powered-By: PHP/8.4.0` (10 Oct)", "PHP adds the header and the proxy passed it on", "The gateway strips `X-Powered-By` from every upstream response", "Folder 09 \"no X-Powered-By\""],
  ["D03", "Page links (`meta.path`, `links`) pointed at Core's internal address, e.g. `http://127.0.0.1:8001` (5 Oct)", "Laravel's paginator builds links from the request host, which is the internal one behind the gateway", "Paginator paths are built from the origin of `PUBLIC_API_URL` (the gateway) plus the request path", "Core search feature test"],
  ["D04", "A new rating did not update the employer's `feedback_count`, so the trust score could stay unpublished (5 Oct)", "The recalculation saved a stale cached Employer model, and Eloquent skipped `feedback_count` as \"unchanged\"", "Score and count are written with a direct UPDATE under a row lock, after the feedback transaction has committed", "T10; Core feedback tests"],
  ["D05", "The trust-score breakdown failed on MySQL although every test passed (5 Oct)", "The SQL alias `of` is a reserved word in MySQL 8 but accepted by SQLite, which the tests used", "Alias renamed; new raw SQL is also tested on MySQL, and CI runs all Core tests on MySQL 8", "T10; Core tests on MySQL in CI"],
  ["D06", "`display_prefs` came back as `{motion, contrast, text_size}` on MySQL; found by the Core tests on MySQL in CI (11 Oct)", "MySQL returns JSON object keys in its own order (shortest first)", "The account resource builds the object key by key in the documented order", "Core tests on MySQL in CI"],
  ["D07", "Employer verification answered 502 `REGISTRY_UNAVAILABLE` although the registry was running (10 Oct, local)", "On Windows the registry started on `localhost` listened on IPv6 only, while Core called `127.0.0.1`", "The registry is started on `127.0.0.1` (README); Core uses `127.0.0.1` URLs", "T14"],
  ["D08", "Snapshots placed some workplaces at a province centre or at a same-name place in another city (Davao, Zamboanga, Lapu-Lapu) (7 Oct)", "Nominatim's first result for a city name is not always the city", "Search \"X, Province\" and, for PSGC's \"City of X\", \"X City\"; accept only a city, town or municipality or a result whose address names it; bundled city centres rebuilt and compared", "Insights Jest tests (geocoder); T12"],
  ["D09", "In CI the employer's newest notice was sometimes `posting_review` instead of `application_received` (11 Oct)", "Both were created in the same second; `created_at` has whole seconds and the ids were random UUIDs", "Time-ordered UUIDv7 ids; the list orders by `created_at`, then id", "T04 in CI"],
  ["D10", "Forgot password answered in about 509 ms for an existing account and 78 ms for an unknown one, so the timing revealed who has an account (13 Oct)", "The token and email were prepared in the request only when the account existed", "Every request only queues the same job; the job checks the account and sends the email (1.8 ms for both, median of 15)", "Core password-reset tests; timing measurement"],
  ["D11", "The Symfony HTTP component used by the Core Service had a published vulnerability (CVE-2026-108082: a crafted `Cache-Control` request header could make header parsing very slow), reachable from the public gateway (21 Oct)", "A dependency version affected by the advisory; found by the dependency audit before merging the new requirements", "A Composer `conflict` rule keeps every affected version out (7.4.21 installed)", "`composer audit` clean; Core tests; Newman"],
  ["D12", "After the switch to Tailwind CSS, dialogs opened in the top-left corner instead of the centre (21 Oct)", "Tailwind's CSS reset removed the browser's automatic margin of the `<dialog>` element", "The shared stylesheet centres dialogs again", "Browser check of every page in the new look"],
  ["D13", "On a phone the employer dashboard was wider than the screen (23 Oct)", "A visually hidden column label of the postings table escaped the table's scroll box", "The label stays inside the scroll box", "Browser check at phone width"],
  ["D14", "The CI axe check reported low colour contrast on six elements of the Home page after the push of 25 October, although the page passed on the developers' machines (25 Oct)", "The Home hero fades in step by step; on the slower CI runner axe measured the text while it was still partly transparent – a timing problem of the test, not of the page", "The axe script waits until the page's entrance animations have ended before it measures", "CI run 40182232704: axe 33 pages, 0 violations; local run 33 / 0"],
], [560, 2500, 2300, 2900, 1820], { size: 16 }));
C.push(note("Overpass degradation: in the CI T13 run the restarted Insights Service still answered from a cached Overpass result (`cached`), the designed degradation; the strict `unavailable` path is covered by the Insights Jest tests and was shown in the local T13 run of 23 October 2026, where the Insights Service was started without its cache database."));

// ---------- 8 Deployment ----------
C.push(H1("8. Deployment and DevOps"));
C.push(H2("8.1 Deployment Architecture"));
C.push(...fig("fig5_deployment.png", 2200, 1280, "Deployment architecture: Vercel and Railway, public and private network boundaries, CI/CD path"));
C.push(H2("8.2 Cloud Deployment"));
C.push(...table(["Component", "Provider / Platform", "URL / Host", "Configuration"], [
  ["React SPA", "Vercel (Hobby), project `opendoor` linked to the GitHub repository", "https://opendoor-rust.vercel.app", "Root `frontend/`; build `npm run build`; output `dist/`; `VITE_API_URL` = gateway URL; `frontend/vercel.json` rewrites every route to `index.html` (deep links work on reload)"],
  ["API Gateway", "Railway service (Dockerfile: `node:22-alpine`)", "https://gateway-production-4e58.up.railway.app (the only public domain)", "`CORE_URL`, `INSIGHTS_URL` (internal hostnames), `CORS_ALLOWED_ORIGIN` = the Vercel URL, `TRUST_PROXY=1`, `RATE_LIMIT_PER_MIN=120`; health check `/api/health`"],
  ["Core Service", "Railway service (Dockerfile: FrankenPHP, PHP 8.4)", "core-api.railway.internal:8001 (no public domain)", "`APP_ENV=production`, `APP_DEBUG=false`, `DB_*`, `PUBLIC_API_URL`, `PUBLIC_APP_URL`, `REGISTRY_WSDL_URL`, `INSIGHTS_INTERNAL_URL` (city-centre points), `SERVICE_KEY_INSIGHTS`, `MAIL_MAILER=brevo`; pre-deploy command `php artisan migrate --force`; health check `/up`; a Railway volume at `storage/app` for logos and résumés (the container disk is not kept between deploys). `RUN_SCHEDULER=1` starts `php artisan schedule:work` next to the web server: it closes expired postings (00:05), sends rating reminders (08:00) and works the email queue every minute (password-reset links)"],
  ["Insights Service", "Railway service (Dockerfile: `node:22-alpine`)", "insights-service.railway.internal:8002 (no public domain)", "`CORE_INTERNAL_URL`, `SERVICE_KEY_INSIGHTS`, `NOMINATIM_CONTACT_EMAIL`, `CACHE_DB_*`, `PSGC_URL`, `NOMINATIM_URL`, `OVERPASS_URL`, `OVERPASS_FALLBACK_URL` (second Overpass server)"],
  ["Business Registry (SOAP)", "Railway service (Dockerfile: FrankenPHP, PHP 8.4 + soap)", "business-registry-soap.railway.internal:8003 (no public domain)", "`REGISTRY_SOAP_USER/PASSWORD`; the SQLite registry is seeded at every start (demo data only)"],
  ["MySQL 8", "Railway MySQL template (MySQL 8.4) with a volume", "mysql.railway.internal:3306 (no public port)", "Schemas `opendoor_core` and `insights_cache` with separate users (each limited to its schema); InnoDB buffer pool lowered to 256 MB because a trial service has 1 GB RAM"],
  ["Email", "Brevo (free plan, 300 emails per day)", "https://api.brevo.com (HTTPS API)", "`MAIL_MAILER=brevo`, `BREVO_API_KEY`, `MAIL_FROM_ADDRESS` (a sender address verified in Brevo). Railway blocks outbound SMTP on its Trial, Free and Hobby plans, so mail goes through Brevo's HTTPS API with Symfony's Brevo mailer"],
], [1700, 2200, 2700, 3480], { size: 16 }));
C.push(P("**How it was deployed (15–16 October 2026).** All Railway services run in the Singapore region (`asia-southeast1`), the region closest to the Philippines. Each code service is built from its Dockerfile in its own root directory and deploys automatically from GitHub `main` when its folder changes (Railway watch paths, so a frontend-only push rebuilds nothing on Railway). The services, variables, volume and public domain were configured with the Railway CLI and its GraphQL API; the database users were created and the demo data seeded (`php artisan db:seed --force`) over Railway's SSH access, so neither the database nor the internal services have a public port. The demo accounts' email notifications are switched off in production because their `@opendoor.test` addresses cannot receive mail."));
C.push(P("**Release of 25 October 2026 and secret rotation.** Railway reported a security incident on 21 October 2026 and paused deployments; every production variable had to be treated as exposed. The changes of 21–23 October (Section 1.4) were deployed together with new secrets on 25 October 2026, in this order: (1) both production databases were backed up with `mysqldump` over Railway's SSH access, and the six new migrations and the seeders were run on a local copy of that backup first – both passed without duplicate data; (2) `INSIGHTS_INTERNAL_URL` was added to the Core Service and `main` was pushed: Railway rebuilt the Core and Insights services (the gateway and registry had not changed and were skipped), the pre-deploy command migrated the database, and `php artisan db:seed --force` added the skills list; (3) every secret was replaced – `APP_KEY`, the passwords of the MySQL users `root`, `opendoor_core` and `insights` (`ALTER USER`), `SERVICE_KEY_INSIGHTS`, the registry SOAP user and password, the Brevo API key and the demo password (old demo sessions signed out) – and the three services that read them were redeployed; the services could not reach the database for a few minutes between the password change and the redeploy. Checks through the public gateway afterwards: health, logins, the snapshot (Insights calls Core with the new service key), a registry check over SOAP and the read-only smoke run (Section 7.2)."));
C.push(P("**Limitations.** The deployment uses Railway's Free Trial: a one-time US$5 credit valid for 30 days, at most five services per project and 1 GB RAM with shared vCPU per service – which is why the scheduler shares the Core container instead of running as a sixth service. All tests of 15–16 October used about US$0.05 of the credit. Vercel's Hobby plan hosts the frontend. Neither is sized for production load (Section 7.3). Demo accounts for every role and enough feedback to show a published trust score are seeded; a second demo employer has two responses and a demo candidate's hire with the feedback window open, so the third response (test T10) can be shown live. Both URLs are documented in the README and submitted before the defense."));
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
│  ├─ postman/                  collection generator, collection + environments
│  ├─ jmeter/                   .jmx test plan, README
│  ├─ a11y/                     axe / WCAG checks (Playwright), UI reference builder
│  └─ mock-external/            stand-in for PSGC, Nominatim and Overpass in CI
├─ docker/                      MySQL init scripts for the container stack
├─ docker-compose*.yml          containers for the CI integration test
├─ docs/                        OpenAPI, diagrams, accessibility audit, this document
├─ .github/workflows/ci.yml     CI pipeline
├─ PROGRESS.md                  checklist, decisions, known issues, session log
└─ README.md                    setup, URLs, demo accounts (no secrets)`));
C.push(...bullets([
  "**Branches:** `main` is the deployed branch and `develop` the integration branch. During development the team committed small, tested changes directly to `main`; every push and pull request to either branch runs the CI workflow, so a failing change shows up at once.",
  "**Commits:** Conventional Commits (`feat(core): add match ranking`, `fix(gateway): strip X-Powered-By`, `test(postman): add T06`), each with its code, tests and progress note together.",
  "**Tracking:** `PROGRESS.md` holds the phase checklist, dated design decisions, known issues and a session log, so any team member can see what is done and what comes next.",
]));
C.push(H2("8.4 CI/CD Workflow"));
C.push(P("GitHub Actions workflow `.github/workflows/ci.yml`:"));
C.push(...table(["Stage", "Trigger", "Steps"], [
  ["Validate & test", "Push to `main` or `develop`; pull request to either; manual run (runs every job)", "Path-filtered jobs (only the changed components) run in parallel: **frontend** – `npm ci`, oxlint (with `jsx-a11y` accessibility rules), Vitest unit tests (React Testing Library), `npm run build`; **gateway** and **insights-service** – `npm ci`, ESLint, Jest unit tests (external APIs mocked with nock); **core-api** – `composer install`, Laravel Pint, `php artisan test` against a MySQL 8 service container (policies, status transitions, trust score); **business-registry-soap** – `php -l`, WSDL checked with `xmllint`, unit and SOAP smoke tests."],
  ["Integration test", "Same as above, after the jobs pass", "Throwaway secrets generated; `docker compose up` of gateway, core, insights, registry and MySQL from the same Dockerfiles as Railway, with PSGC, Nominatim and Overpass replaced by a mock server; migrate and seed; Newman runs the full collection and a second time folder 07 with Overpass unreachable (T13); the built frontend is checked with axe (WCAG 2.1 A/AA) on the main pages of every role with Playwright Chromium; the Newman HTML reports are uploaded as an artifact."],
  ["Deploy", "Push/merge to `main`", "Vercel and Railway GitHub integrations build and deploy the changed components automatically (Railway watch paths: only the services whose folder changed); Laravel migrations run as the Railway pre-deploy command; Railway health checks (`/up`, `/health`, `/api/health`) gate the switch to the new version."],
  ["Post-deploy smoke test", "After a deploy (run by the team, not yet in `ci.yml`)", "`node tests/postman/build-smoke.mjs` builds the read-only subset of the collection (80 requests) and Newman runs it against the production gateway with the production demo password (25 Oct 2026: 435 assertions, 0 failures; 16 Oct 2026: 73 requests, 389 assertions, 0 failures – Section 7.2). Automating it in CI would need that password as a GitHub secret. If it fails, the team rolls back with Railway/Vercel \"redeploy previous\"."],
], [1800, 2400, 5880], { size: 16 }));
C.push(H2("8.5 Environment and Startup Instructions"));
C.push(P("Full instructions are in the repository README. Local development runs every component natively (PHP 8.4, Composer, Node.js 22, MySQL 8); Docker is used only by the CI pipeline and the Railway images. Summary (no real secret values shown):"));
C.push(...code(`
# 1. Clone and copy environment files
git clone <repository-url> opendoor && cd opendoor
cp services/core-api/.env.example services/core-api/.env      # repeat for each component

# 2. Create the databases once (MySQL 8): opendoor_core and insights_cache, each with its own user
mysql -u root -p < docs/setup/create-databases.sql

# 3. Core Service (Laravel)                       http://localhost:8001
cd services/core-api && composer install && php artisan key:generate
php artisan migrate --seed && php artisan serve --port=8001
php artisan queue:work database --stop-when-empty                # sends queued password-reset emails

# 4. Business Registry (SOAP)                     http://localhost:8003/soap?wsdl
cd services/business-registry-soap && php seed.php && php -S 127.0.0.1:8003 -t public

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
C.push(note("Screens of the release deployed on 25 October 2026, captured that day with the demo accounts on the local stack with a freshly seeded test database, in a desktop browser 1,280 px wide (`tests/a11y/sia-screens.mjs`). They are taken locally because the script applies for a job, reports a hire and runs a registry check, which would change the demo data in production. The snapshot close-up is from 23 October 2026 (same snapshot code): on 25 October the public Overpass servers answered too slowly; its nearby places come from the Insights Service's saved copy of OpenStreetMap data."));
[
  ["Public – Find jobs (/jobs)", "Guests search by keyword and filter by work setup, category and accommodations; each job card leads with the salary, place and work setup, the required skills and qualifications, and shows the employer's Verified badge and trust score (M5).",
    [["guest-jobs.jpg", 1421, 1438, 560]]],
  ["Candidate – Profile: \"About you\" and \"Accommodations you need\" (/candidate/profile)", "The profile a candidate completes before applying – location, at least three skills from the shared list (with suggestions read from the uploaded résumé), education, experience and work preferences – and the accommodation needs recorded once from the shared, grouped list; disability type is optional and private (M2).",
    [["cand-profile-about.jpg", 1420, 1563, 440], ["cand-profile-needs.jpg", 1420, 1125, 300]]],
  ["Candidate – Find jobs, \"Recommended for me\" (/candidate/jobs)", "Postings ranked by match score (\"Match: 100% · Strong match\"); \"Why this match?\" lists each part – skills, location, qualifications, work preferences and the accommodation needs offered; Save keeps a job for later (M5, M12).",
    [["cand-jobs.jpg", 1421, 1563, 580]]],
  ["Candidate – Job details and Accessibility Snapshot (/candidate/jobs/:id)", "One page combines the posting, \"How this job fits you\", the trust score and the Workplace Accessibility Snapshot from the Insights mashup (Core + PSGC + Nominatim + Overpass) – here with the saved copy of the map data and a note saying so, because Overpass did not answer; Read aloud and Apply with an interview accommodation request (M4, M6, M7).",
    [["cand-job.jpg", 1420, 1438, 420], ["cand-snapshot.jpg", 940, 1177, 330]]],
  ["Candidate – Application with stages and hiring confirmation (/candidate/applications/:id)", "\"Where it stands\" shows the stages; the employer has reported the hire with a start date, and the candidate can Confirm, answer Not yet or say it is Incorrect – a hire counts only when both sides confirm it (M6).",
    [["cand-application.jpg", 1420, 1341, 560]]],
  ["Candidate – Rating form (from day 30 after the confirmed start date)", "The hired candidate rates each accommodation the posting promised when the hire was confirmed; the answers are anonymous and feed the employer's trust score (M7).",
    [["cand2-feedback.jpg", 1420, 1096, 480]]],
  ["Employer – Dashboard (/employer/dashboard)", "Open jobs, new applications, pending hire confirmations and confirmed hires; the job postings by status, what needs attention, where the applications stand, the trust score, a 12-week chart of applications and hires, and recent activity (M8).",
    [["emp-dashboard.jpg", 1421, 1875, 600]]],
  ["Employer – Post or edit a job: steps 4 and 5 (/employer/jobs/:id/edit)", "Six-step form, the same for a new posting and for editing: step 4 holds the optional salary, benefits and schedule and what the employer asks applicants for; step 5 the structured accommodations with optional notes. A verified company's posting goes live as soon as it is published (M4).",
    [["emp-posting-salary.jpg", 1420, 1482, 350], ["emp-posting-accommodations.jpg", 1420, 1563, 350]]],
  ["Employer – Application with the hiring report, and trust score", "The employer moves an applicant through the stages and reports the hire with the first working day – nothing changes until the candidate confirms; the trust score page shows the aggregated score and its per-accommodation breakdown, never single answers (M6, M7).",
    [["emp-application.jpg", 1420, 1563, 420], ["emp-trust.jpg", 1420, 881, 260]]],
  ["Admin – Employer verification with registry check (/admin/employers/:id)", "Result of the SOAP Business Registry check (status, registered name, name match) shown beside the employer's submitted details; the administrator decides (M3, M10).",
    [["admin-employer.jpg", 1420, 951, 520]]],
  ["Admin – Dashboard with charts (/admin/dashboard)", "Work queues (employers to verify, open reports) and charts, each with a table view: activity over 12 weeks, how far applications get, whether promised accommodations were delivered, and the most needed accommodations next to the open jobs that offer them; then platform counts (M8).",
    [["admin-dashboard.jpg", 1420, 2125, 620]]],
].forEach(([cap, fn, images]) => C.push(...screenSlot(cap, fn, images)));
C.push(H2("9.2 End-to-End Demonstration Scenario"));
C.push(...numbered([
  "**User action in client application:** the demo candidate (`candidate@opendoor.test`; complete profile; needs: wheelchair-accessible entrance, accessible restroom, written or captioned meetings) logs in, opens Find jobs with \"Recommended for me\" on and sees three results ranked by match score: \"Data Encoder\" (Match: 100% · Strong match – all 4 required skills, same city, education and experience met, preferred setup and type, all 3 needs offered), \"Customer Support Associate (Chat)\" (50% · Fair match – 1 of 3 needs, none of the 4 skills) and \"Junior Web Developer\" (25% · Low match). The candidate opens \"Data Encoder\" by Bayanihan Tech Solutions and then the Workplace Accessibility Snapshot section.",
  "**Gateway/integration request:** the SPA sends `GET /api/job-postings/1` with the candidate's token (so the match is included) and, when the snapshot section is opened, `GET /api/insights/job-postings/1` to the API Gateway, which adds an `X-Request-ID` and routes them to the Core and Insights services.",
  "**Service-to-service interaction:** the Core Service authenticates the token, computes the match score from the candidate's profile and needs (with the city-centre points it got from the Insights Service when the locations were saved) and returns the trust score; the Insights Service calls the Core Service's internal summary endpoint with its service key.",
  "**External/legacy API interaction:** the Insights Service resolves the PSGC code, geocodes the address with Nominatim and queries Overpass for wheelchair-tagged places within 500 m. (Separately, the admin demo shows the Core Service calling the SOAP Business Registry for the employer waiting for verification, Kalinga Foods Inc., SEC `CS201912345`: ACTIVE, name match 100%.)",
  "**Transformation/mashup:** OSM tags are mapped to accessible transit, toilets and parking with distances, and merged with the employer's advertised accommodations and the community trust score into the Workplace Accessibility Snapshot.",
  "**Final result shown to user:** the job details page shows \"Match: 100% · Strong match\" with \"How this job fits you\", the Verified employer badge, the trust score \"79% of promised accommodations were delivered. Based on 3 responses.\" and the accessible places OpenStreetMap lists within 500 m (when the screenshots in 9.1 were taken on 23 October 2026, from the Insights Service's saved copy because the public Overpass servers did not answer: no tagged transit stops, toilets or parking, and two other places – The Marketplace 423 m and The Feast Timog 462 m away). The candidate applies – the profile is complete and the seeded résumé is on file – with an interview accommodation request and sees the application as Submitted (`pending`), while the employer receives an in-app notification and, with emails on, an email. The employer then moves it through Under review, Shortlisted and Contacted and reports the hire with a start date; once the candidate confirms, the rating opens on day 30 after that date (the second sequence in Section 5.1). On a posting that meets only some needs, the details page names the missing skills and accommodations.",
]));

// ---------- 10 Evaluation ----------
C.push(H1("10. Evaluation of the Final Solution"));
C.push(H2("10.1 Achievement of Objectives"));
C.push(...table(["Objective", "Success Measure", "Result / Evidence"], [
  ["1 – Integrated application", "All Must-have modules work end to end through the gateway; T01–T11 pass", "Achieved – T01–T11 pass (final run of 23 October 2026, Section 7.1); all 13 modules M1–M13 are built, including the \"Could have\" M12 and M13, together with the changes of 21–23 October (match score, stages, mutual hiring confirmation), and were checked in the browser with the demo accounts of every role (screens in 9.1)."],
  ["2 – Service, external and legacy integration", "Snapshot built from 4 sources; SOAP registry check stored; degradation works (T12–T16)", "Achieved – T12–T16 pass; the snapshot combines Core, PSGC, Nominatim and Overpass (every source live on 7 Oct 2026); on 23 Oct 2026, with both public Overpass servers down, it still answered with the other sections (`overpass: unavailable`); the Core Service gets city-centre points from the Insights Service; registry checks are stored in `registry_checks`; each source failing is covered by Jest/nock and Core tests and degrades as designed."],
  ["3 – Security", "Security tests T08, T09, T16 pass; no secrets in repository (secret scan)", "Achieved – T08, T09, T16 and the further security cases of folder 09 pass; only `.env.example` files with placeholders are tracked and CI generates throwaway secrets; secret scan with gitleaks 8.30.1 over the full git history (313 commits, 25 Oct 2026): no leaks found. Dependency audits of 25 Oct 2026: Core (`composer audit`) and frontend clean; two advisories in indirect dependencies of the gateway and Insights Service – `body-parser` (denial of service through a compressed request body; neither service parses request bodies itself) and `ip-address` (slow parsing of a long IPv6 string, through the rate limiter) – fixed with patch updates, tests passing."],
  ["4 – Quality assurance", "Newman run with 0 failed assertions; JMeter P95 < 1,500 ms and error rate < 1% at 50 users", "Achieved, with one note – final Newman run: 1,064 of 1,065 assertions passed; the failed one is a response-time check during an outage of both public Overpass servers, while every functional check passed (Section 7.2); the CI run of the deployed code (run 40182232704, 25 Oct, mock APIs) had 1,065 assertions, 0 failed, and the production smoke runs 389 (16 Oct) and 435 assertions (25 Oct), 0 failed. JMeter on production (16 Oct 2026): P95 748 ms with 50 concurrent users (204 ms in the documented 60 s ramp-up profile) and 0% errors in all six runs (Section 7.3)."],
  ["5 – Cloud deployment and DevOps", "Public URLs working; CI green on main; automatic deploy and smoke test", "Achieved – frontend https://opendoor-rust.vercel.app and gateway https://gateway-production-4e58.up.railway.app (Railway, Singapore; only the gateway public); CI green on `main` with all seven jobs (run 40182232704, 25 October 2026); Vercel and Railway deploy `main` automatically from GitHub (Railway per changed service folder); read-only Newman smoke against production: 80 requests, 435 assertions, 0 failed (25 Oct 2026, after the release and the secret rotation; 16 Oct: 73 / 389 / 0). The smoke run is started by the team, not yet by CI (Section 8.2)."],
  ["6 – Accessibility and usability", "No critical axe/Lighthouse issues; NVDA walkthrough; mean SUS ≥ 68 (n ≥ 5 PWD, 3 employers)", "axe: no violations on 33 pages of the freshly seeded stack (23 Oct 2026, current design), 33 pages after the IPT restyle (21 Oct 2026) and 33 pages in CI (14 Oct 2026); Lighthouse accessibility 100 on the 6 guest pages (11 Oct 2026, before the redesign); scripted keyboard, focus and reflow checks pass (`docs/accessibility/wcag-audit.md`). [[NVDA walkthrough]] [[Mean SUS score (n PWD, n employers)]]"],
], [2600, 4000, 3480]));
C.push(H2("10.2 Technical Limitations"));
C.push(...bullets([
  "**Simulated legacy integration:** the Business Registry is a SOAP simulation with seeded data, not the real DTI/SEC systems; real integration would require an agreement with those agencies.",
  "**Open data coverage:** accessibility data near workplaces depends on OpenStreetMap tagging, which is incomplete in many Philippine areas; absence of data does not mean a place is inaccessible.",
  "**Provider restrictions:** public Nominatim and Overpass instances are rate-limited and intended for light use; heavier use would need self-hosted instances or a commercial provider.",
  "**Scale:** trial-tier hosting with one Core instance on a shared vCPU (throughput levels off at about 80 requests/s, Section 7.3), a single MySQL instance shared by two schemas, and synchronous calls limit throughput; apart from the small database queue for password-reset emails there is no message broker, and no horizontal scaling is used.",
  "**Security scope:** no multi-factor authentication or OAuth 2.0; service keys are static shared secrets rather than mutual TLS or signed tokens.",
  "**Trust score validity:** the score depends on honest self-reported feedback and needs enough hires per employer to be meaningful. A hire also needs both parties to confirm it, so a hire that one side never confirms is not rated.",
  "**Match score:** the weights are fixed by the team and not tested with users yet; distance is measured between city centres, not street addresses; skills match only by name and alias from the shared list, so a skill written differently and not in the list counts as missing.",
  "**Simplified in the final build:** keyword search uses a case-insensitive `LIKE` instead of the MySQL full-text index; Voice input depends on the browser's speech service and is therefore offered only in Chrome and Edge; emails go through Brevo's free plan (300 per day) from a single verified sender address (a team member's school email) instead of an authenticated OpenDoor domain, so receiving servers may sort them as spam; the \"Contact us\" page of the UI design was not built because no contact details were available.",
]));
C.push(H2("10.3 Recommended Improvements"));
C.push(...bullets([
  "**Asynchronous events (message broker):** publish `application.status_changed` and `feedback.saved` events (e.g., RabbitMQ or Redis Streams) so notifications, emails and trust-score recalculation run in separate workers with retries, instead of after the response in the same process or on the database queue – improves response time and resilience.",
  "**OAuth 2.0 / OpenID Connect sign-in** (e.g., Google) and optional multi-factor authentication – easier and safer login for users who rely on assistive technology to type passwords.",
  "**Official data partnerships:** integrate with PhilJobNet/PESO or DTI/SEC if APIs become available, replacing the simulated registry and avoiding duplicate registration.",
  "**Signed service tokens or mutual TLS** between services instead of static keys.",
  "**Observability:** centralized logs and tracing (OpenTelemetry) keyed by `X-Request-ID`, and uptime alerts.",
  "**Tune the match score with users:** compare the weights with what PWD job seekers and employers find relevant (for example in the SUS sessions), and let administrators manage the skills list and its aliases in the admin portal.",
  "**Contributing back to OpenStreetMap:** let hired PWDs suggest accessibility tags for their workplace area to improve the open data that the mashup relies on.",
]));
C.push(H2("10.4 Lessons Learned"));
C.push(note("[[Draft written from the project record (commits, PROGRESS.md, test results). The team reviews it, corrects it and adds its own experience – including deployment and the JMeter run – before submission; then remove this note.]]"));
C.push(...bullets([
  "**Service boundaries paid off when external services failed.** The public Overpass and Nominatim servers were overloaded or unreachable several times during development (HTTP 504 after 6–16 s, connection failures). Because only the Core Service is required for a job page, hiring kept working and the snapshot degraded to cached, stale or \"unavailable\" parts. The price was three runtimes (PHP, Node.js, MySQL) to run locally, which strained the 7.3 GB of memory of the main development laptop.",
  "**Free public APIs need defensive code, not just a client.** Caching, per-source timeouts, cooldowns, a second Overpass server and a background refresh were all added after real failures; Nominatim's first result was sometimes the wrong place (D08), so results had to be checked against the PSGC location; PSGC's own 9-digit codes differed from the official 10-digit ones the rest of the system uses.",
  "**Integration through a gateway changes what a URL or header means.** Three defects (D01–D03) came from the services answering as if the client talked to them directly: a permissive CORS header, the PHP version header and page links with an internal host. Each was found only by testing through the gateway.",
  "**Test on the database you deploy.** The fast SQLite test database hid two MySQL differences (D05, D06); running the Core tests on MySQL 8 in CI caught the second one immediately. Likewise the Newman run in CI found a same-second ordering bug (D09) that never appeared on a slower local machine.",
  "**Writing the API contract first let the work run in parallel.** All frontend screens were built against `docs/openapi.yaml` before most backend modules existed, and the Postman collection, OpenAPI file and SIA document were kept in step with each change.",
  "**Automated accessibility checks are necessary but not enough.** axe reported no violations, yet scripted keyboard, focus and reflow checks still found problems (focus lost after an action, cards overflowing at 200% text and 320 px); a screen-reader walkthrough with NVDA remains the final check.",
  "**Requirements that change after a release touch every layer.** The team's clarifications of 21–22 October (required profile, match score, new stages, mutual hiring confirmation) each needed a migration, contract and test changes, new screens and this document. One rule changed twice within a day (\"Contacted replaces Hired\", then Hired again with mutual confirmation); because the first version was not yet deployed, its migration could be replaced instead of piling up.",
  "**Security problems can hide in behaviour, not code.** The forgot-password endpoint gave the same message for every email but answered faster for unknown ones (D10); only measuring the response time showed that it revealed who has an account.",
]));

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
  "Braille Institute of America. (n.d.). Atkinson Hyperlegible font. https://www.brailleinstitute.org/freefont/",
  "Brevo. (n.d.). Send a transactional email (API reference). Brevo Developers. https://developers.brevo.com/reference/sendtransacemail",
  "Department of Labor and Employment. (n.d.). PhilJobNet and PESO Employment Information System. Retrieved September 28, 2026, from https://philjobnet.gov.ph/",
  "Deque Systems. (n.d.). axe-core: Accessibility engine for automated web UI testing. https://github.com/dequelabs/axe-core",
  "Docker. (n.d.). Docker Compose documentation. https://docs.docker.com/compose/",
  "Express.js. (n.d.). Express 4.x API reference. https://expressjs.com/",
  "Fontsource. (n.d.). Fontsource: Self-host open source fonts in neatly bundled NPM packages. https://fontsource.org/",
  "FrankenPHP. (n.d.). FrankenPHP documentation. https://frankenphp.dev/docs/",
  "GitHub. (n.d.). GitHub Actions documentation. https://docs.github.com/actions",
  "Google. (n.d.). Lighthouse overview. Chrome for Developers. https://developer.chrome.com/docs/lighthouse/overview",
  "Laravel. (n.d.). Laravel 13.x documentation: Sanctum, Authorization, Validation. https://laravel.com/docs/13.x",
  "Lexend. (n.d.). Lexend font family. https://www.lexend.com/",
  "Lucide Contributors. (n.d.). Lucide icons. https://lucide.dev/",
  "Meta Open Source. (n.d.). React documentation (version 19). https://react.dev/",
  "Microsoft. (n.d.). Playwright documentation. https://playwright.dev/",
  "Mozilla. (n.d.). Web Speech API. MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API",
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
  "Railway. (n.d.). Free trial; Private networking; Outbound networking. https://docs.railway.com/",
  "Rappler. (2023). Still a long road ahead: PWDs struggle to join Philippine workforce. https://www.rappler.com/newsbreak/in-depth/persons-with-disability-struggle-philippine-workforce/",
  "Remix Software. (n.d.). React Router documentation (version 7). https://reactrouter.com/",
  "Republic Act No. 7277. (1992). Magna Carta for Disabled Persons. Official Gazette of the Republic of the Philippines.",
  "Republic Act No. 10173. (2012). Data Privacy Act of 2012. Official Gazette of the Republic of the Philippines.",
  "Republic Act No. 10524. (2013). An Act expanding the positions reserved for persons with disability, amending Republic Act No. 7277. Official Gazette of the Republic of the Philippines.",
  "Respicio & Co. (n.d.). PWD right to reasonable accommodation in the workplace (Philippines). https://www.lawyer-philippines.com/",
  "Ruzgal, F. A. (2026). opendoor-ipt [Computer software]. GitHub. https://github.com/ryujiinnn08/opendoor-ipt",
  "SDDirect. (2023). Disability inclusion in the Philippines (Disability Inclusion Helpdesk Report No. 61). https://sddirect.org.uk/",
  "Smalot, S. (n.d.). PdfParser: PHP library to extract text from PDF files. https://github.com/smalot/pdfparser",
  "Symfony. (n.d.). Sending emails with Mailer: Brevo transport. https://symfony.com/doc/current/mailer.html",
  "Tailwind Labs. (n.d.). Tailwind CSS documentation (version 4). https://tailwindcss.com/docs",
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
  ["M2 Profile", "GET, PUT", "/candidate/profile", "C", "Own profile (+ `profile_complete`, `profile_missing`)"],
  ["M2 Profile", "GET", "/candidate/resume/skill-suggestions", "C", "Skills found in the uploaded résumé (text never stored)"],
  ["M2 Profile", "PUT", "/candidate/accommodations", "C", "Replace needs"],
  ["M2 Profile", "POST", "/candidate/resume", "C", "Upload PDF résumé (max 5 MB)"],
  ["M2 Profile", "GET", "/resumes/{id}?expires=&signature=", "P (signed link)", "Open résumé PDF (link valid 30 min)"],
  ["M3 Company", "GET, PUT", "/employer/company", "E", "Own company profile"],
  ["M3 Company", "GET", "/employers/{id}", "P", "Public employer page"],
  ["M3 Company", "GET", "/employers/{id}/logo", "P", "Company logo (PNG/JPG/WebP, max 2 MB)"],
  ["M3 Company", "GET", "/admin/employers, /admin/employers/{id}", "A", "Verification queue / details with latest registry check"],
  ["M3 Company", "PATCH", "/admin/employers/{id}/verify", "A", "check (SOAP) / approve / reject"],
  ["M4 Postings", "GET", "/employer/job-postings", "E", "Own postings (`?status=`, with applicant counts)"],
  ["M4 Postings", "POST", "/job-postings", "E", "Create a draft or publish at once (verified company, at least one skill)"],
  ["M4 Postings", "PUT, DELETE", "/job-postings/{id}", "E (owner)", "Update / soft-delete"],
  ["M4 Postings", "PATCH", "/job-postings/{id}/status", "E (owner)", "Close / reopen"],
  ["M4 Postings", "GET", "/admin/job-postings", "A", "Every posting (no approval step since 21 Oct 2026)"],
  ["M4 Postings", "DELETE", "/admin/job-postings/{id}", "A", "Remove any posting with a reason (soft delete; employer notified)"],
  ["M5 Search", "GET", "/job-postings?q=&category=&accommodations[]=&work_setup[]=&distance=&match=1&sort=&page=", "P (match, distance, saved: C)", "Search, filter, match score"],
  ["M5 Search", "GET", "/job-postings/{id}", "P", "Details (+ match, saved and own application for C)"],
  ["M5/M11", "GET", "/categories, /accommodations, /skills", "P", "Filter options; shared skills list with aliases"],
  ["M6 Applications", "POST", "/job-postings/{id}/applications", "C", "Apply (complete profile and résumé needed)"],
  ["M6 Applications", "GET", "/applications, /applications/{id}", "C (own) / E (own postings)", "List / details (stage dates, hiring report history, `job_closed`)"],
  ["M6 Applications", "PATCH", "/applications/{id}/status", "C / E", "Stage: reviewed, shortlisted, contacted, rejected (E); withdrawn (C)"],
  ["M6 Applications", "POST", "/applications/{id}/hiring-reports", "C / E (party)", "Report a hire with a start date"],
  ["M6 Applications", "POST", "/applications/{id}/hiring-reports/{report}/response", "the other party", "Confirm / Not yet (new start date) / Incorrect"],
  ["M7 Feedback", "GET", "/applications/{id}/feedback-form", "C (hired)", "Items to rate (recorded at the confirmed hire), window, submitted"],
  ["M7 Feedback", "POST", "/applications/{id}/feedback", "C (hired, from day 30 after the start date)", "Submit"],
  ["M7 Feedback", "GET", "/employers/{id}/trust-score", "P", "Score and breakdown (from 3 responses)"],
  ["M8 Dashboards", "GET", "/candidate/dashboard, /employer/dashboard, /admin/dashboard", "C / E / A", "Summaries; employer needs attention, recent activity and 12 weeks; admin analytics for the charts"],
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
  ["Onboarding", "PATCH", "/me/onboarding", "C / E", "Welcome tour done; \"Get started\" list hidden or shown again (state returned by login and /me; new accounts start with both false)"],
  ["Insights", "GET", "/insights/job-postings/{id}", "P", "Accessibility Snapshot"],
  ["Insights", "GET", "/insights/locations/{regions|provinces|cities}?parent=", "P", "PSGC lists"],
  ["Internal", "GET", "/internal/job-postings/{id}/summary (Core, not public)", "S", "Data for mashup"],
  ["Internal", "GET", "/internal/places/{code} (Insights, not public)", "S", "City-centre point of a PSGC place for Core"],
  ["Gateway", "GET", "/health", "P", "Health of gateway and services"],
], [1600, 1300, 3800, 1600, 1780], { size: 15 }));
C.push(P("**Role permission summary** (C = create, R = read, U = update, D = delete; enforced by Laravel Policies):"));
C.push(...table(["Data", "Guest", "Candidate", "Employer", "Admin"], [
  ["User account", "C (register), U (reset password by email link)", "R, U own (password, settings)", "R, U own (password, settings)", "C admins, R all, U (suspend)"],
  ["Candidate profile and needs", "–", "C, R, U own", "R (own applicants only)", "R"],
  ["Company profile", "R (public)", "R (public)", "C, R, U own", "R, U (verify)"],
  ["Job posting", "R (open)", "R (open)", "C, R, U, D own (publish when verified)", "R all, D (remove with a reason)"],
  ["Application", "–", "C, R own, U (withdraw; report or answer a hire)", "R, U stage; report or answer a hire (own postings)", "R"],
  ["Accommodation feedback", "–", "C, R own (once, from day 30 after the confirmed start date)", "– (score only)", "R, U (hide)"],
  ["Trust score", "R (3+ responses)", "R (3+ responses)", "R own", "R all"],
  ["Categories and accommodation types", "R", "R", "R", "C, R, U, D"],
  ["Reports on postings", "–", "C (visible postings, one open per posting)", "–", "R, U (dismiss / action)"],
  ["Notifications", "–", "R, U own (mark read)", "R, U own (mark read)", "–"],
  ["Saved jobs", "–", "C, R, D own (visible postings)", "–", "–"],
], [2400, 1500, 2200, 2100, 1880], { size: 16 }));
C.push(P("A **visible posting** is open, not deleted, and published by a verified company whose account is not suspended. Only visible postings appear in search, on the public employer page and in the Accessibility Snapshot, and only they can be opened, saved, applied to or reported by guests and candidates; owners and administrators still see the others."));

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
    <soap:address location="http://business-registry-soap.railway.internal:8003/soap"/>
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
  ["Evidence", "Final run of 23 October 2026: HTML reports `tests/postman/reports/local-full-2026-10-23.html` (216 requests / 1,065 assertions / 1 failed – the Overpass timing check, Section 7.2) and `local-t13-2026-10-23.html` (15 / 87 / 0), kept out of git because they contain throwaway test tokens. CI run 40182232704 (25 Oct 2026, deployed code): artifact `newman-reports`, 216 / 1,065 / 0 and 15 / 87 / 0. Earlier CI run 38493807232 (14 Oct 2026): 193 / 933 / 0 and 15 / 87 / 0"],
  ["Production smoke", "`node tests/postman/build-smoke.mjs` → `OpenDoor.smoke.postman_collection.json` (80 read-only requests); run with `-e production.postman_environment.json`: 25 Oct 2026 80 / 435 / 0, 17.5 s, average response 138 ms (report `tests/postman/reports/production-smoke-2026-10-25.html`); 16 Oct 2026: 73 / 389 / 0, 18.4 s, 170 ms (`production-smoke-2026-10-16.html`); reports kept out of git"],
], [2400, 7680], { kv: true }));

C.push(H2("Appendix D - JMeter/load-test configuration and results"));
C.push(...table(["Element", "Configuration"], [
  ["Test plan", "`tests/jmeter/opendoor-matching.jmx`"],
  ["User Defined Variables", "`host` = gateway host, `protocol` = https, `port`, `pageSize` = 12 (each read from a `-J` property with a default)"],
  ["CSV Data Set Config", "`tokens.csv` (`-Jtokens=`) – 50 load-test candidate tokens written by `php artisan load-test:data` (load-test accounts only, never real users; removed with `--remove`)"],
  ["Thread Groups", "One Thread Group driven by `-Jthreads`, `-Jrampup`, `-Jloops`: Load 50 threads, 60 s ramp-up, 10 loops · Stress 100 and 200 threads, 60 s ramp-up, 5 loops · the same three again with `-Jrampup=5` (burst) so that all users run at the same time"],
  ["Samplers", "HTTP Request `GET /api/job-postings?match=1&page=${__Random(1,10)}`; HTTP Request `GET /api/job-postings/${postingId}`"],
  ["Header Manager", "`Authorization: Bearer ${token}`, `Accept: application/json`"],
  ["Assertions", "Response Assertion: code 200; JSON Assertions: `$.meta.match_mode == true` and `$.meta.per_page == ${pageSize}`; Duration Assertion: 3,000 ms"],
  ["Listeners", "Summary Report, Aggregate Report; HTML dashboard generated with `-e -o report/`"],
  ["Results", "Production, 16 October 2026: summary table in Section 7.3; per-sampler Aggregate Report below. HTML dashboards `tests/jmeter/report/prod-*` and raw results `results-prod-*.jtl` (kept out of git; the burst dashboards were also generated at 1 s granularity with `jmeter -g … -Jjmeter.reportgenerator.overall_granularity=1000`, because the runs lasted under a minute)."],
], [2400, 7680], { kv: true }));
C.push(...table(["Run", "Sampler", "Samples", "Average", "Median", "P90", "P95", "P99", "Max", "Error %", "Throughput"], [
  ["Load 50 (60 s)", "Search", "500", "134", "116", "204", "226", "334", "1,117", "0.00", "8.2/s"],
  ["", "Details", "500", "82", "76", "100", "119", "177", "241", "0.00", "8.4/s"],
  ["Stress 100 (60 s)", "Search", "500", "143", "118", "222", "234", "317", "929", "0.00", "8.3/s"],
  ["", "Details", "500", "81", "76", "99", "123", "179", "191", "0.00", "8.4/s"],
  ["Stress 200 (60 s)", "Search", "1,000", "144", "123", "219", "239", "308", "895", "0.00", "16.6/s"],
  ["", "Details", "1,000", "81", "75", "100", "118", "161", "492", "0.00", "16.8/s"],
  ["Burst 50 (5 s)", "Total", "1,000", "497", "500", "699", "748", "825", "1,114", "0.00", "72.4/s"],
  ["Burst 100 (5 s)", "Total", "1,000", "862", "909", "1,281", "1,333", "1,404", "1,463", "0.00", "77.5/s"],
  ["Burst 200 (5 s)", "Total", "2,000", "1,954", "2,010", "2,786", "2,838", "2,922", "2,997", "0.00", "81.3/s"],
], [1500, 900, 850, 850, 850, 800, 800, 800, 850, 840, 1040], { size: 14 }));
C.push(P("Times in milliseconds. Search = `GET /api/job-postings?match=1&page=…`, Details = `GET /api/job-postings/{id}`."));
C.push(...fig("screens/jmeter-burst-200.png", 1110, 769, "JMeter dashboard, Response Times Over Time (1 s granularity): 200 users at the same time – averages climb to about 2.8 s while all users are active, with no failed request"));

C.push(H2("Appendix E - Repository structure / deployment notes"));
C.push(P("Repository structure: Section 8.3. Additional deployment notes:"));
C.push(...bullets([
  "Local development runs natively (Section 8.5). `docker-compose.yml` is used only in CI: it defines `mysql`, `core-api`, `insights-service`, `business-registry-soap`, `gateway` and a `mock-external` server so tests never depend on public Nominatim/Overpass.",
  "Railway (Free Trial, Singapore region): one project with five services – `gateway`, `core-api` (also runs `schedule:work` when `RUN_SCHEDULER=1`, because the trial allows only five services), `insights-service`, `business-registry-soap` and `MySQL`; only `gateway` has a public domain; services reference each other with `${{service.RAILWAY_PRIVATE_DOMAIN}}` variables. Production secrets were generated once and entered through the Railway API; administration (database users, seeding, load-test data) used `railway ssh` instead of public database ports.",
  "Laravel production: `php artisan config:cache route:cache`, `migrate --force` as the pre-deploy command. In-app notices are stored at once and their emails are sent after the HTTP response; password-reset emails go through the `database` queue, which the scheduler works every minute.",
  "Seeders: 11 job categories, 18 RA 7277-based accommodation types in five groups, a shared list of 98 skills with aliases, one administrator, demo candidate/employer accounts (passwords from `DEMO_PASSWORD`) – the demo candidates with complete profiles and a generated one-page résumé PDF, since applying needs one – demo postings with skills, qualifications and salary, sample feedback that publishes one employer's trust score (79% from three responses), a second employer with two responses and an open demo hire for test T10, and sample DTI/SEC records in `registry.db`. JMeter data is created separately with `php artisan load-test:data`.",
  "Before the defense: call `/api/health`, and open each job page once the day before so that the Accessibility Snapshot's nearby places are cached (the public Overpass servers are often overloaded; a cached result stays fresh for 24 hours and is served as `stale` after that).",
]));

C.push(H2("Appendix F - Additional screenshots or diagrams"));
C.push(P("**Core Service data model** (MySQL `opendoor_core`). Accommodations are stored once in a lookup table and linked to postings, candidate needs and feedback through pivot tables, so the same vocabulary drives filtering, matching and per-accommodation ratings."));
C.push(...table(["Table", "Key Fields", "Notes"], [
  ["users", "id, name, email, password, role, is_active, consented_at, display_prefs (JSON), email_notifications, onboarding_tour_done, onboarding_checklist_hidden, timestamps", "Shared auth table (Sanctum); unique email; suspension; consent; M13 settings (emails on by default); onboarding state (new accounts start with both false; accounts that existed before onboarding and the demo accounts start as done)"],
  ["password_reset_tokens", "email (PK), token (hashed), created_at", "One reset link per account; valid 60 minutes, removed once used"],
  ["candidate_profiles", "id, user_id, headline, skills (JSON list of skill names), experience, education_level, experience_years, preferred_work_setups (JSON), preferred_employment_types (JSON), location_psgc, location_label, location_lat, location_lon, location_province_psgc, location_checked_at, disability_type (nullable), show_disability, resume_path", "1:1 with candidate users; disability type optional, hidden and never used for matching; the point and province come from the Insights Service"],
  ["employers", "id, user_id, company_name, business_reg_no, registry_type, industry, address, location_psgc, location_label, description, logo_path, verified_at, verification_rejected_reason, trust_score, feedback_count", "`trust_score` is a whole percentage 0–100 (null until rated); shown publicly only from 3 responses"],
  ["registry_checks", "id, employer_id, business_reg_no, registry_type, status, registered_name, name_match_score, raw_response (XML answer), checked_by, checked_at", "Every SOAP verification call; `ERROR` when the registry could not answer"],
  ["categories / accommodations", "id, name / id, name, group, description, is_retired", "Admin-managed lists"],
  ["skills", "id, name (unique), aliases (JSON), timestamps", "Shared skills list (98 seeded); profiles and postings store skill names, normalized to the list name when a name or alias matches"],
  ["job_postings", "id, employer_id, category_id, title, description, responsibilities, skills (JSON), education_level, experience_years, qualifications, salary_min, salary_max, salary_period, benefits, schedule, application_requirements, address, location_psgc, location_label, location_lat, location_lon, location_province_psgc, location_checked_at, employment_type, work_setup, interview_format, status, closes_at, is_approved, rejection_reason, deleted_at", "Soft deletes; indexes (status, category_id) and (employer_id, status); MySQL full-text index on title and description (keyword search currently uses a case-insensitive LIKE); salary in whole pesos, null when not disclosed"],
  ["job_posting_accommodation", "job_posting_id, accommodation_id, note", "Pivot: accommodations provided"],
  ["candidate_accommodation", "candidate_profile_id, accommodation_id", "Pivot: accommodations needed"],
  ["applications", "id, job_posting_id, candidate_profile_id, status, cover_note, interview_request, reviewed_at, shortlisted_at, contacted_at, hired_at, hire_start_date, feedback_reminded_at, timestamps", "Unique (job_posting_id, candidate_profile_id); the stage dates draw the timeline; `hired_at` = when the hire was confirmed, `hire_start_date` = the confirmed start date (the rating opens 30 days later); \"Job closed\" is computed, not stored; `feedback_reminded_at` makes the rating reminder a one-time notice"],
  ["hiring_reports", "id, application_id, reported_by (employer / candidate), reporter_id, start_date, status, responded_at, timestamps", "One report waiting for an answer per application (checked under a row lock); kept as history, separate from the stage"],
  ["hiring_report_events", "id, hiring_report_id, actor_role, actor_id, action, start_date, created_at", "Every report and answer (reported, confirmed, not yet, disputed, cancelled) – the API shows roles, not people"],
  ["application_accommodation", "application_id, accommodation_id", "Pivot: the posting's accommodations recorded when the hire is confirmed (the items the candidate rates)"],
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
  ["notifications.type", "`application_received`, `application_status_changed`, `hiring_report`, `employer_verification`, `posting_review`, `feedback_reminder`"],
  ["candidate_profiles.education_level, job_postings.education_level", "`elementary` < `high_school` < `senior_high` < `vocational` < `college` < `postgraduate` (a posting's minimum)"],
  ["candidate_profiles.preferred_work_setups / preferred_employment_types", "values of `work_setup` / `employment_type` below"],
  ["job_postings.salary_period", "`hour`, `day`, `month`, `year` (required with a salary)"],
  ["employers.registry_type", "`DTI`, `SEC`"],
  ["registry_checks.status", "`ACTIVE`, `EXPIRED`, `CANCELLED`, `NOT_FOUND`, `ERROR`"],
  ["accommodations.group", "`physical_access`, `communication`, `work_arrangement`, `assistive_technology`, `support`"],
  ["job_postings.employment_type", "`full_time`, `part_time`, `contract`, `internship`"],
  ["job_postings.work_setup", "`onsite`, `hybrid`, `remote`"],
  ["job_postings.interview_format", "`online`, `onsite`"],
  ["job_postings.status", "`draft`, `open`, `closed` (`pending_approval` remains in the column type but is no longer used since the approval step was removed)"],
  ["applications.status", "`pending` (Submitted), `reviewed` (Under review), `shortlisted`, `contacted`, `hired`, `rejected` (Not selected), `withdrawn`"],
  ["hiring_reports.reported_by, hiring_report_events.actor_role", "`employer`, `candidate`"],
  ["hiring_reports.status", "`pending`, `confirmed`, `disputed`, `cancelled`"],
  ["hiring_report_events.action", "`reported`, `confirmed`, `not_yet`, `disputed`, `cancelled`"],
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
C.push(P("**Entity-relationship diagram** of the Core Service database, drawn from the Laravel migrations in `services/core-api/database/migrations` (Laravel's own token, queue, cache and session tables are left out). Further screens of every role are in the separate UI reference (`docs/ui-reference/OpenDoor-UI-Reference.pdf`)."));
C.push(...fig("fig6_erd.png", 1700, 1964, "Entity-relationship diagram of the Core Service database (MySQL opendoor_core)"));

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
