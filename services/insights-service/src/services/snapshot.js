import { ApiError } from '../lib/errors.js';
import { placeQuery } from './geocoder.js';

export const DISCLAIMER = 'Map data from OpenStreetMap contributors (ODbL); coverage may be incomplete.';

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** "2026-10-07T10:05:40+08:00" (the platform's time zone, as in Core). */
export function manilaTimestamp(date = new Date()) {
  return `${new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 19)}+08:00`;
}

/** Core's stored label "City, Province, Region" (NCR: "City, Region") → { city, province }. */
function placeFromLabel(label) {
  const parts = (label ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return { city: parts[0], province: parts.length >= 3 ? parts[1] : null };
}

function groupClaims(accommodations) {
  const claims = {};
  for (const { name, group } of accommodations) (claims[group] ??= []).push(name);
  return claims;
}

/**
 * Workplace Accessibility Snapshot: Core (posting) → PSGC (place names) → Nominatim (coordinates)
 * → Overpass (accessible places nearby). Only Core is required; every other source degrades to
 * `unavailable` and the snapshot is still 200.
 *
 * The whole snapshot must fit in `budgetMs` (below the gateway's 15 s). A source still running
 * when the budget is used up counts as unavailable; its request continues and fills the cache,
 * so the next snapshot for the same place is fast.
 */
export function createSnapshotService({ core, locations, geocode, nearby, budgetMs, log = console }) {
  return async function snapshot(id, { requestId } = {}) {
    const deadline = Date.now() + budgetMs;
    const late = Symbol('late');
    const withinBudget = (start) => {
      // Nothing new is started once the budget is used up.
      if (Date.now() >= deadline) return Promise.resolve(late);
      const promise = start();
      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(late), Math.max(0, deadline - Date.now()));
      });
      return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    };

    let summary;
    try {
      summary = await core.postingSummary(id, requestId);
    } catch (err) {
      log.error(JSON.stringify({ request_id: requestId, source: 'core', error: err.code ?? err.response?.status ?? err.message }));
      throw new ApiError('SERVICE_UNAVAILABLE');
    }
    if (!summary) throw new ApiError('NOT_FOUND');

    const sources = { core: 'ok', psgc: 'unavailable', nominatim: 'unavailable', overpass: 'unavailable' };
    const location = { psgc_code: summary.psgc_code ?? null, label: summary.location_label ?? null, lat: null, lon: null, precision: null };

    // PSGC: official names for the label and the geocoding query.
    let place = placeFromLabel(summary.location_label);
    if (summary.psgc_code) {
      const described = await withinBudget(() => locations.describe(summary.psgc_code).catch(() => null));
      if (described && described !== late) {
        place = described;
        location.label = [described.city, described.province, described.region].filter(Boolean).join(', ');
        sources.psgc = described.source;
      }
    }

    // Nominatim: coordinates of the workplace (or the city centre).
    const geocoded = await withinBudget(() =>
      geocode({ address: summary.address, place: place ? placeQuery(place) : null, psgcCode: summary.psgc_code }),
    );
    if (geocoded !== late) {
      Object.assign(location, { lat: geocoded.lat, lon: geocoded.lon, precision: geocoded.precision });
      sources.nominatim = geocoded.source;
    }

    // Overpass: accessible places around those coordinates.
    let nearbyAccessible = null;
    if (location.lat !== null && location.lon !== null) {
      const found = await withinBudget(() => nearby({ lat: location.lat, lon: location.lon }));
      if (found !== late) {
        nearbyAccessible = found.nearby;
        sources.overpass = found.source;
      }
    }

    const score = summary.trust_score;
    return {
      job_posting_id: summary.id,
      location,
      employer_claims: groupClaims(summary.accommodations),
      community_verification: score?.published
        ? { trust_score: score.score, based_on: score.based_on, breakdown: score.breakdown ?? [] }
        : null,
      nearby_accessible: nearbyAccessible,
      sources,
      disclaimer: DISCLAIMER,
      generated_at: manilaTimestamp(),
    };
  };
}
