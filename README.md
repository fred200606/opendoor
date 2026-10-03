# OpenDoor

OpenDoor helps persons with disabilities (PWDs) find jobs by the **workplace accommodations** they need, and lets hired PWDs verify, accommodation by accommodation, whether the employer delivered. Employers earn a public **trust score** from that feedback.

Final project for **SIA 1** (Systems Integration and Architecture) and **IPT**. The approved design is in [`docs/OpenDoor_SIA1_Final_Project_Documentation.docx`](docs/OpenDoor_SIA1_Final_Project_Documentation.docx).

## Architecture

```
React SPA (Vercel) ──HTTPS──▶ API Gateway (Node/Express, :8080) ─┬─▶ Core Service (Laravel 13 + MySQL, :8001) ──SOAP──▶ Business Registry (PHP SoapServer, :8003)
                                                                └─▶ Insights Service (Node/Express, :8002) ──▶ Nominatim · Overpass · PSGC
                                                                         └── /internal/* ──▶ Core Service
```

| Folder | Component |
|---|---|
| `frontend/` | React (Vite) SPA – public area and Candidate / Employer / Admin portals |
| `gateway/` | API Gateway – single public entry, routing, CORS, rate limit, request IDs |
| `services/core-api/` | Core Service – auth, profiles, postings, matching, applications, feedback, trust score |
| `services/insights-service/` | Accessibility Insights mashup – Workplace Accessibility Snapshot, PSGC locations |
| `services/business-registry-soap/` | Simulated DTI/SEC registry exposed as a legacy SOAP 1.1 service |
| `tests/postman/`, `tests/jmeter/` | API and load tests |
| `docs/` | SIA documentation, diagrams, `openapi.yaml`, setup scripts |

## Requirements

PHP 8.3+ with Composer, Node.js 22, MySQL 8. Docker is **not** needed for local development (it is only used by CI and the Railway images).

## Local setup

```bash
# 1. Environment files (then fill in the empty values – never commit .env)
cp frontend/.env.example frontend/.env
cp gateway/.env.example gateway/.env
cp services/core-api/.env.example services/core-api/.env
cp services/insights-service/.env.example services/insights-service/.env
cp services/business-registry-soap/.env.example services/business-registry-soap/.env

# 2. Databases (once): replace the CHANGE_ME passwords in a local copy, then
mysql -u root -p < docs/setup/create-databases.sql

# 3. Core Service                         http://localhost:8001
cd services/core-api && composer install && php artisan key:generate
php artisan migrate --seed && php artisan serve --port=8001

# 4. Business Registry (SOAP)             http://localhost:8003/soap?wsdl
cd services/business-registry-soap && php seed.php && php -S localhost:8003 -t public

# 5. Insights Service and API Gateway     http://localhost:8002 · http://localhost:8080
cd services/insights-service && npm ci && npm run dev
cd gateway && npm ci && npm run dev

# 6. React client                         http://localhost:5173
cd frontend && npm ci && npm run dev
```

Shared values that must match:

| Value | Set in |
|---|---|
| `SERVICE_KEY_INSIGHTS` | core-api, insights-service |
| `REGISTRY_SOAP_USER` / `REGISTRY_SOAP_PASSWORD` | core-api, business-registry-soap |

## Tests

```bash
cd services/core-api && php artisan test
cd gateway && npm test
cd services/insights-service && npm test
npx newman run tests/postman/OpenDoor.postman_collection.json -e tests/postman/local.postman_environment.json
```

## Deployment

- Frontend: Vercel (`frontend/`)
- Gateway, services, MySQL: Railway (only the gateway is public)

Production URLs and demo accounts: _to be added after deployment_.

## Development workflow

- Branches: `main` (deployed), `develop`, `feature/<module>-<desc>`, `fix/<desc>`
- Conventional Commits with the component as scope, e.g. `feat(core): add match ranking`
- Progress is tracked in [`PROGRESS.md`](PROGRESS.md)
