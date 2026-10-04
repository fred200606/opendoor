# OpenDoor Frontend

React 19 + Vite single-page app: public area plus Candidate, Employer and Admin portals. It talks **only** to the API Gateway (`VITE_API_URL`), never to a service directly.

| Path | What |
|---|---|
| `src/api/client.js` | The one Axios instance: adds the Bearer token, turns every failure into an `ApiError` (`status`, `code`, `message`, `requestId`, `fieldErrors`), logs out on 401 |
| `src/api/*.js` | One module per resource: `auth`, `jobs`, `profile` (candidate + company), `applications` (+ feedback), `insights`, `account` (dashboards, notifications), `masterData`, `admin` |
| `src/auth/` | `AuthContext` (`user`, `role`, `login`, `register`, `logout`), `ProtectedRoute role="…"`, `homeFor(role)` → `/{role}/dashboard` |
| `src/components/Page.jsx` | Every screen starts with `<Page title>`: sets the document title and moves focus to the `<h1>` after navigation |

`ProtectedRoute` is navigation only – the server enforces every permission.

## Screens

| Area | Paths |
|---|---|
| Public | `/`, `/login`, `/register`, `/jobs`, `/jobs/:id`, `/employers/:id` |
| Candidate | `/candidate/dashboard`, `/candidate/profile`, `/candidate/jobs`, `/candidate/jobs/:id`, `/candidate/applications`, `/candidate/applications/:id`, `/candidate/applications/:id/feedback`, `/candidate/saved-jobs` |
| Employer | `/employer/dashboard`, `/employer/company`, `/employer/jobs`, `/employer/jobs/new`, `/employer/jobs/:id/edit`, `/employer/jobs/:id/applicants`, `/employer/applications/:id`, `/employer/trust-score` |
| Admin | `/admin/dashboard`, `/admin/employers`, `/admin/employers/:id`, `/admin/job-postings`, `/admin/users`, `/admin/reports`, `/admin/feedback`, `/admin/master-data` |
| Any logged-in user | `/notifications`, `/account` (password, display settings) |

Every screen follows `docs/openapi.yaml`. Screens whose endpoints are not built yet show the API error until their backend phase lands.

To audit a page with axe in the browser console during `npm run dev`: load `/node_modules/axe-core/axe.min.js` and run `axe.run()`.

Accessibility (WCAG 2.1 AA) is checked on every change: skip link, focus on route change, visible focus, contrast ≥ 4.5:1, labels on every input, usable at 360 px and 200% zoom. `oxlint` runs the `jsx-a11y` rules.

## Local setup

```powershell
npm ci
copy .env.example .env    # VITE_API_URL=http://localhost:8080/api (the gateway)
npm run dev               # http://localhost:5173 (must match the gateway's CORS_ALLOWED_ORIGIN)
npm test                  # Vitest + Testing Library (API faked, no network)
npm run lint
npm run build
```
