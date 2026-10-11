# Conventions

## Laravel (core-api)

- Routes in `routes/api.php` grouped by role: `Route::middleware(['auth:sanctum', 'role:employer'])->prefix('employer')`. Internal routes in `routes/internal.php` with `service.key` middleware.
- Thin controllers; validation in Form Requests (`Rule::exists`, `Rule::enum`); authorization in Policies; output through API Resources (decide per role which fields appear – never expose feedback authors or unneeded candidate data).
- Business logic in service classes (`MatchingService`, `TrustScoreService`, `ApplicationWorkflow`, `BusinessRegistryClient`); observers for recalculation and notifications.
- Query scopes on `JobPosting`: `visible()`, `search($q)`, `inCategory($id)`, `withAccommodations($ids)`, `withMatchCount($needIds)`. Always paginate.
- Business errors: throw an `ApiException(code, message, status)` rendered into the envelope.
- `APP_TIMEZONE=Asia/Manila`; return ISO 8601 with offset.

## Node (gateway, insights-service)

- ES modules, Node 22, Express 4. Structure: `src/app.js` (express app, exported for tests), `src/server.js` (listen), `src/routes/`, `src/clients/` (one per external system), `src/lib/errors.js` (envelope helpers).
- Config only from `process.env` via `src/config.js` with validation at startup.
- Axios instances per upstream with explicit `timeout`; never unbounded calls.

## React (frontend)

- Keep the existing UI components; add only what the API needs.
- `src/api/client.js`: one Axios instance (`baseURL: import.meta.env.VITE_API_URL`), request interceptor adds Bearer token, response interceptor: 401 → logout + redirect to `/login`; 422 → return `errors` for field display; others → show `error.message` (include `request_id` in a small "reference" line for support).
- One API module per resource: `api/jobs.js`, `api/profile.js`, `api/applications.js`, `api/feedback.js`, `api/insights.js`, `api/admin.js`.
- `AuthContext` holds `user`, `role`, `token`, `login()`, `logout()`. `ProtectedRoute role="candidate|employer|admin"`. Routes `/candidate/*`, `/employer/*`, `/admin/*` as in the Modules spec.
- Search/filter state in the URL query string; debounce keyword input ~300 ms.

## Accessibility (WCAG 2.1 AA) – check on every UI change

- Everything keyboard-operable, visible focus, skip-to-content link; focus moves to the page `<h1>` on route change.
- Every input has a visible `<label>`; errors linked with `aria-describedby` and announced.
- Contrast ≥ 4.5:1; status shown with text/icon, never color alone (StatusBadge, MatchBadge).
- Result counts announced in an `aria-live="polite"` region ("12 jobs found") that stays on the page, also for 0 results – for paged lists `components/ResultCount.jsx` above `<AsyncContent>`, never inside it.
- Modals trap focus and close with Escape; no session time-outs during forms.
- Never put native `disabled` on a button that can have focus (submit while sending, pagination edges, "done" states): it drops focus to `<body>`. Use `components/Button.jsx` (`aria-disabled` + ignored clicks).
- Usable at 200% zoom and 360 px width.
- Snapshot section: plain-language headings, distances as text ("220 m away"), explain unavailable data in text.

## General

- Never commit `.env`, `vendor/`, `node_modules/`, `registry.db` generated at runtime (commit the seed script instead), JMeter results, or Newman reports.
- Write user-facing text in plain English.
- When you add or change an endpoint, field, rule or error code: update `docs/openapi.yaml`, the Postman collection, and tell the user which documentation section to update (use the `opendoor-sia-docs` skill).
