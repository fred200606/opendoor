// Plain-language text for the `match` object (MatchingService in Core, decision 2026-10-21).

export const MATCH_LABELS = { strong: 'Strong match', good: 'Good match', fair: 'Fair match', low: 'Low match' };

export const MATCH_TONES = { strong: 'success', good: 'info', fair: 'neutral', low: 'neutral' };

const TIERS = {
  remote: 'Remote work',
  same_city: 'In your city',
  same_province: 'In your province',
  same_region: 'In your region',
  farther: 'Outside your region',
};

/** "about 12 km away" (city centre to city centre), or null. */
export function distanceText(km) {
  if (km === null || km === undefined) return null;
  return km < 1 ? 'less than 1 km away' : `about ${km} km away`;
}

/** "In your region, about 12 km away"; null when the place is unknown. */
export function locationText(location) {
  const tier = TIERS[location?.tier];
  if (!tier) return null;
  const distance = location.tier === 'remote' ? null : distanceText(location.distance_km);
  return distance ? `${tier}, ${distance}` : tier;
}

/** Short reasons for a result card: skills, place and needs. */
export function matchSummary(match) {
  const skills = match.skills ?? { matched: [], missing: [] };
  const skillTotal = skills.matched.length + skills.missing.length;
  return [
    skillTotal > 0 && `${skills.matched.length} of ${skillTotal} skills`,
    locationText(match.location),
    match.total > 0 && (match.met === match.total ? `Meets all ${match.total} of your needs` : `Meets ${match.met} of your ${match.total} needs`),
  ].filter(Boolean);
}
