# Integrations

## 1. Business Registry (legacy SOAP) – `services/business-registry-soap`

Simulated DTI/SEC registry. Must stay a genuine SOAP integration: published WSDL, document/literal, SOAP faults, WS-Security header.

- Endpoint `POST /soap`, WSDL `GET /soap?wsdl`, namespace `urn:opendoor:registry:v1`.
- Operation `VerifyBusinessRegistration`, SOAPAction `urn:opendoor:registry:v1#VerifyBusinessRegistration`.
- Request elements: `RegistrationNumber` (string), `RegistryType` (enum DTI | SEC), `BusinessName` (string).
- Response elements: `Found` (boolean), `Status` (ACTIVE | EXPIRED | CANCELLED | NOT_FOUND), `RegisteredName` (optional), `DateRegistered` (optional, xsd:date), `NameMatchScore` (decimal 0–1), `CheckedAt` (dateTime).
- Header: `wsse:Security/wsse:UsernameToken` with `Username`/`Password` = `REGISTRY_SOAP_USER`/`REGISTRY_SOAP_PASSWORD`.
- Faults: `soapenv:Client.Authentication` (bad/missing credentials), `soapenv:Client.Validation` (bad input), `soapenv:Server` (internal).
- `NameMatchScore`: normalize both names (uppercase, strip punctuation and suffixes like INC., CORP., CO.), then similarity (e.g. `similar_text` percentage / 100, or Levenshtein-based), rounded to 2 dp.
- Implementation: PHP `SoapServer` with the WSDL file; handler class reads `registry.db` via PDO; validate the UsernameToken before processing.

**Core side (Laravel):** a `BusinessRegistryClient` service class wrapping `SoapClient` (`REGISTRY_WSDL_URL`, `connection_timeout` 5, `exceptions => true`, `trace => true` in non-production) that adds the WS-Security header with `SoapHeader`, maps the response to an array/DTO, stores a `registry_checks` row (raw XML in `raw_response`), and converts faults: `Client.Authentication` → 502 `REGISTRY_AUTH_FAILED`; `Client.Validation` → 422 `REGISTRY_INVALID_REQUEST`; `Server` fault, connection error or timeout → 502 `REGISTRY_UNAVAILABLE` (store a `registry_checks` row with status `ERROR`). Bind it in a service provider so tests can fake it.

## 2. Accessibility Insights Service (mashup) – `services/insights-service`

`GET /api/insights/job-postings/{id}` builds the Workplace Accessibility Snapshot:

1. **Core** – `GET ${CORE_INTERNAL_URL}/internal/job-postings/{id}/summary` with `X-Service-Key` (timeout 3 s). 404 → return 404 (posting not open).
   As built (`src/sources/core.js`): never cached; any other failure (down, timeout, 401, unexpected body) → 503 `SERVICE_UNAVAILABLE`. Ids that are not 1…2³¹−1 → 404 without asking Core.
2. **PSGC** – resolve `psgc_code` to `City, Province, Region` label (cache 7 days).
   As built (`locations.describe`): city → province → region from the cached lists; highly urbanized cities (Cebu 0730600000) don't share their province's code prefix, so the region's provinces are searched, prefix match first. Fallback lists count as `stale`. PSGC down → Core's `location_label` ("City, Province, Region" from the picker; NCR "City, Region").
   **Budget** (`src/services/snapshot.js`): the whole snapshot gets 12 s (gateway allows 15 s); a source still running at the deadline is `unavailable` and nothing new is started, but its request continues and fills the cache.
3. **Nominatim** – `GET /search?q=<address, label>&countrycodes=ph&format=jsonv2&limit=1` with header `User-Agent: OpenDoor/1.0 (${NOMINATIM_CONTACT_EMAIL})`; max 1 request/second (queue); timeout 5 s; cache 30 days. On failure fall back to the city centroid, `precision: "city"`, and report `sources.nominatim: "unavailable"`.
   As built (`src/services/geocoder.js`): no street match → search the place (`precision: "city"`, cached under the same address hash). Place queries (`placeQueries`): "X, Province" (NCR "Metro Manila"; PSGC's "City of" dropped), then for "City of X" also "X City, Province" and "X City". Each place search takes the top 5 and accepts a city/town/municipality first, else the first result whose address names the city (free-text search often has no city boundary – Mandaue, Ormoc – and the bare name also finds provinces, villages and streets elsewhere: "Davao, Davao del Sur" = the province); no match at all → bundled centroid with `nominatim: "ok"`; queue wait > 2 s → not sent (no cooldown); failure → 60 s cooldown, stale entry, bundled centroid (`src/data/city-centroids.json`, PSGC code → `{lat, lon}`, built with `npm run build:city-centroids`), else `lat/lon/precision: null`. No contact email → Nominatim never called.
4. **Overpass** – POST to `${OVERPASS_URL}` (timeout 8 s, cache 24 h):
   ```
   [out:json][timeout:8];
   ( node(around:500,LAT,LON)["wheelchair"~"yes|limited"];
     way(around:500,LAT,LON)["wheelchair"~"yes|limited"]; );
   out center tags 50;
   ```
5. **Transform** – map OSM tags to categories (checked top to bottom, first match wins; same table as SIA doc 4.5):
   - `transit_stops`: `public_transport=*`, `highway=bus_stop`, `railway=station|halt|tram_stop`, `amenity=bus_station`
   - `toilets`: `amenity=toilets` or `toilets:wheelchair=yes`
   - `parking`: `amenity=parking` (incl. `capacity:disabled`)
   - `other`: everything else
   Distance with haversine (metres, integer); de-duplicate by OSM id; keep the nearest 3 per category; keep `wheelchair` as `yes` or `limited`.
   As built (`src/services/nearby.js`): cache key = point rounded to 4 dp + radius, payload = trimmed elements, distances from the exact point; way centres beyond the radius dropped; unnamed places dropped from `other` only; 429/504 HTML or a `runtime error` remark = failure (never cached) → stale entry, else `nearby_accessible: null`; 60 s cooldown. The public overpass-api.de instance is often busy (seen 504 after 16 s on 2026-10-07) – the 8 s timeout + cooldown + cache keep the snapshot fast.
6. **Combine** and respond 200 even if some sources failed:
```json
{ "job_posting_id": 42,
  "location": { "psgc_code": "1381300000", "label": "Quezon City, National Capital Region (NCR)", "lat": 14.6507, "lon": 121.0494, "precision": "street" },
  "employer_claims": { "physical_access": [ "Wheelchair-accessible entrance" ] },
  "community_verification": { "trust_score": 86, "based_on": 5, "breakdown": [ ... ] },
  "nearby_accessible": { "radius_m": 500, "transit_stops": [ { "name": "Quezon Ave. MRT Station", "wheelchair": "yes", "distance_m": 220 } ], "toilets": [], "parking": [], "other": [] },
  "sources": { "core": "ok", "psgc": "cached", "nominatim": "ok", "overpass": "ok" },
  "disclaimer": "Map data from OpenStreetMap contributors (ODbL); coverage may be incomplete.",
  "generated_at": "2026-10-02T10:05:40+08:00" }
```
`sources` values: `ok` | `cached` | `stale` | `unavailable`. `community_verification` is `null` when the score is unpublished.

`GET /api/insights/locations/{regions|provinces|cities}?parent=<code>` proxies PSGC (`/regions`, `/regions/{code}/provinces`, `/provinces/{code}/cities-municipalities`; NCR has no provinces – use `/regions/{code}/cities-municipalities`), normalizes to `[{code, name, level}]` sorted by name, caches 7 days, and falls back to a bundled JSON of all regions, provinces and their cities/municipalities.
- Codes: OpenDoor uses the official **10-digit** PSGC code (`psgc10DigitCode`) everywhere; the PSGC API's URLs take its 9-digit `code`. They differ by more than a digit (BARMM `150000000` ↔ `1900000000`), so cached items keep the API code as `ref` and parents are looked up, never converted. `parent` must match `^\d{10}$` (422 `VALIDATION_FAILED` with `errors.parent`); unknown region/province → 404.
- Region names: `Ilocos Region (Region I)`, `National Capital Region (NCR)`. Levels: `region | province | city | municipality`.
- Failure order: fresh cache (`cached`) → PSGC (`ok`) → expired entry (`stale`) → `src/data/psgc-fallback.json` (`fallback`; built by `npm run build:psgc-fallback`) → 503 `SERVICE_UNAVAILABLE`. Header `X-Data-Source` tells which. A failed source is skipped for 60 s (cooldown) so one request waits for one timeout at most; the same `createCached` helper is meant for Nominatim/Overpass.

**Core side:** `/internal/*` routes in a separate route file guarded by a `ServiceKey` middleware (constant-time compare with `hash_equals`); not under `auth:sanctum`.

**Never** call Nominatim/Overpass from tests or CI – use a mock server (e.g. a tiny Express app or `nock` in Jest) with recorded fixtures.

## 3. Gateway – `gateway/`

- `http-proxy-middleware` with `proxyTimeout`/`timeout` per route (Core 10 s, Insights 15 s); `on.error` → envelope 502 `UPSTREAM_ERROR` / 504 `UPSTREAM_TIMEOUT` / 503 `SERVICE_UNAVAILABLE`.
- `cors({ origin: CORS_ALLOWED_ORIGIN, credentials: false })`, `express-rate-limit` 120/min/IP → 429 `RATE_LIMITED`.
- Request-ID middleware: reuse incoming `X-Request-ID` or create `crypto.randomUUID()`; set on proxied request and response.
- Do not parse bodies before proxying (or re-stream them) so multipart uploads still work.
- Block `/internal/*`.
