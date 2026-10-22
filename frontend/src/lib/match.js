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

/**
 * Every part of the match in one short line each, for "Why this match?" on a job card:
 * [{ result: 'yes' | 'partly' | 'no', text }]. The job page explains each part in MatchDetails.
 */
export function matchParts(match) {
  const skills = match.skills ?? { matched: [], missing: [] };
  const skillTotal = skills.matched.length + skills.missing.length;
  const place = locationText(match.location);
  const tier = match.location?.tier;
  const prefs = match.preferences ?? {};
  const fits = (met) => (met ? 'yes' : 'no');
  const share = (have, total) => (have === total ? 'yes' : have > 0 ? 'partly' : 'no');
  return [
    skillTotal > 0 && { result: share(skills.matched.length, skillTotal), text: `You have ${skills.matched.length} of the ${skillTotal} required skills` },
    place && { result: ['remote', 'same_city', 'same_province'].includes(tier) ? 'yes' : tier === 'same_region' ? 'partly' : 'no', text: place },
    match.education?.required && { result: fits(match.education.met), text: match.education.met ? 'Your education meets the minimum' : 'Your education is below the minimum' },
    match.experience?.required_years && { result: fits(match.experience.met), text: match.experience.met ? 'Your experience meets the minimum' : 'Less experience than the job asks for' },
    prefs.work_setup !== null && prefs.work_setup !== undefined && { result: fits(prefs.work_setup), text: prefs.work_setup ? 'A work setup you prefer' : 'Not a work setup you chose' },
    prefs.employment_type !== null && prefs.employment_type !== undefined && { result: fits(prefs.employment_type), text: prefs.employment_type ? 'A type of work you want' : 'Not a type of work you chose' },
    match.total > 0 && { result: share(match.met, match.total), text: match.met === match.total ? `Offers all ${match.total} of your accommodation needs` : `Offers ${match.met} of your ${match.total} accommodation needs` },
  ].filter(Boolean);
}
