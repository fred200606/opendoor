# OpenDoor Accessibility Insights Service

Node.js 22 + Express 4 (ESM). Private service behind the gateway, which forwards `/api/insights/*` unchanged.

| Endpoint | Purpose |
|---|---|
| `GET /health` | 200 `{status:'ok', cache:'up'\|'down'}` – pinged by the gateway |
| `GET /api/insights/locations/{regions\|provinces\|cities}?parent=` | PSGC lists for the location picker: `[{code, name, level}]` with 10-digit codes |
| `GET /api/insights/job-postings/{id}` | Workplace Accessibility Snapshot (Phase 7, in progress) |

## Location lists

- Source: the PSGC API (`PSGC_URL`). Its URLs use 9-digit codes; OpenDoor uses the official 10-digit codes. They are not convertible by rule (BARMM `150000000` ↔ `1900000000`), so the service finds the API code of a parent in the cached region/province lists.
- Cache: MySQL `insights_cache.psgc_cache`, keys `regions`, `provinces:{region}`, `cities:{region|province}`, 7 days.
- When PSGC fails: expired cache entry (`stale`) → bundled `src/data/psgc-fallback.json` (all regions + provinces, NCR, the cities of each province) → 503 `SERVICE_UNAVAILABLE`. After a failure PSGC is skipped for 60 s, so one request waits for one 5 s timeout at most.
- `X-Data-Source` response header: `ok`, `cached`, `stale` or `fallback`.
- Rebuild the fallback from live data: `npm run build:psgc-fallback`.

## Geocoding (Nominatim, used by the snapshot)

- `NOMINATIM_CONTACT_EMAIL` is required by the [usage policy](https://operations.osmfoundation.org/policies/nominatim/) and sent as `User-Agent: OpenDoor/1.0 (<email>)`. Without it Nominatim is never called (cache and bundled centroids only).
- At most 1 request/s (queue); a request that would wait more than 2 s is not sent. Timeout 5 s; after a failure Nominatim is skipped for 60 s.
- Order: `geocode_cache` (30 days, key = SHA-256 of the normalized "address, place") → "address, place" (`precision: street`) → "place" (`precision: city`, stored under the same key) → expired entry (`stale`) → `src/data/city-centroids.json` by PSGC code (`precision: city`, source `unavailable`) → no coordinates.
- Build the centroids once (≈2.5 min, needs the contact email): `npm run build:city-centroids`. OSM boundary relations were not usable instead: too few carry the 10-digit PSGC `ref`, and their bounding-box centres can lie in the sea (Manila).

## Cache database

The tables (`psgc_cache`, `overpass_cache`, `geocode_cache`) are created at startup (`CREATE TABLE IF NOT EXISTS`). The database is optional: if it is down, reads count as misses and the service keeps answering. Without `CACHE_DB_USER` an in-memory cache is used.

## Local setup

```powershell
npm ci
copy .env.example .env    # fill CACHE_DB_PASSWORD, SERVICE_KEY_INSIGHTS, NOMINATIM_CONTACT_EMAIL
npm run dev               # http://localhost:8002, restarts on file changes
npm test                  # Jest + supertest; PSGC is faked with nock (no real API calls)
npm run lint
```
