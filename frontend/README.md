# OpenDoor Frontend

React 19 + Vite single-page app: public area plus Candidate, Employer and Admin portals. It talks **only** to the API Gateway (`VITE_API_URL`), never to a service directly.

| Path | What |
|---|---|
| `src/api/client.js` | The one Axios instance: adds the Bearer token, turns every failure into an `ApiError` (`status`, `code`, `message`, `requestId`, `fieldErrors`), logs out on 401 |
| `src/api/*.js` | One module per resource (`auth.js`, later `jobs.js`, `profile.js`, …) |
| `src/auth/` | `AuthContext` (`user`, `role`, `login`, `register`, `logout`), `ProtectedRoute role="…"`, `homeFor(role)` → `/{role}/dashboard` |
| `src/components/Page.jsx` | Every screen starts with `<Page title>`: sets the document title and moves focus to the `<h1>` after navigation |

`ProtectedRoute` is navigation only – the server enforces every permission.

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
