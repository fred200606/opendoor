// Sample API payloads shaped exactly like docs/openapi.yaml.

export const categories = [
  { id: 1, name: 'Administrative' },
  { id: 3, name: 'Information Technology' },
];

// GET /skills (decision 2026-10-21)
export const skillsList = [
  { id: 4, name: 'Data entry', aliases: ['Encoding'] },
  { id: 3, name: 'Filing and records management', aliases: ['Filing'] },
  { id: 1, name: 'Microsoft Excel', aliases: ['Excel', 'MS Excel'] },
  { id: 2, name: 'Typing', aliases: [] },
];

export const accommodationGroups = [
  {
    group: 'physical_access',
    label: 'Physical access',
    items: [
      { id: 1, name: 'Wheelchair-accessible entrance', group: 'physical_access', description: null, is_retired: false },
      { id: 2, name: 'Accessible restroom', group: 'physical_access', description: null, is_retired: false },
    ],
  },
  {
    group: 'communication',
    label: 'Communication',
    items: [{ id: 5, name: 'Sign language interpreter', group: 'communication', description: null, is_retired: false }],
  },
];

export const job = {
  id: 42,
  title: 'Data Encoder',
  description: 'Encode records.\nWork with the admin team.',
  skills: ['Data entry', 'Microsoft Excel'],
  education_level: 'senior_high',
  experience_years: 1,
  qualifications: null,
  employer: { id: 7, company_name: 'Bayanihan Tech Solutions', verified: true },
  category: { id: 1, name: 'Administrative' },
  address: '123 Quezon Ave.',
  location: { psgc_code: '1381300000', label: 'Quezon City, NCR' },
  employment_type: 'full_time',
  work_setup: 'onsite',
  interview_format: 'online',
  status: 'open',
  closes_at: '2026-11-30',
  accommodations: [
    { id: 1, name: 'Wheelchair-accessible entrance', group: 'physical_access', note: 'Ramp at main entrance' },
    { id: 5, name: 'Sign language interpreter', group: 'communication', note: null },
  ],
  // MatchingService (decision 2026-10-21).
  match: {
    score: 74,
    label: 'good',
    met: 1,
    total: 2,
    missing: [{ id: 2, name: 'Accessible restroom' }],
    skills: { matched: ['Data entry'], missing: ['Microsoft Excel'] },
    location: { tier: 'same_city', distance_km: 2.4 },
    education: { required: 'senior_high', met: true },
    experience: { required_years: 1, met: false },
    preferences: { work_setup: true, employment_type: true },
  },
  trust_score: { published: true, score: 86, based_on: 5 },
  created_at: '2026-10-01T09:00:00+08:00',
};

export const snapshot = {
  job_posting_id: 42,
  location: { psgc_code: '1381300000', label: 'Quezon City, Metro Manila, NCR', lat: 14.65, lon: 121.04, precision: 'street' },
  employer_claims: { physical_access: ['Wheelchair-accessible entrance'], communication: ['Sign language interpreter'] },
  community_verification: { trust_score: 86, based_on: 5, breakdown: [] },
  nearby_accessible: {
    radius_m: 500,
    transit_stops: [{ name: 'Quezon Ave. MRT Station', wheelchair: 'yes', distance_m: 220 }],
    toilets: [],
    parking: [{ name: null, wheelchair: 'limited', distance_m: 1450 }],
    other: [],
  },
  sources: { core: 'ok', psgc: 'cached', nominatim: 'ok', overpass: 'ok' },
  disclaimer: 'Map data from OpenStreetMap contributors (ODbL); coverage may be incomplete.',
  generated_at: '2026-10-02T10:05:40+08:00',
};

export const application = {
  id: 11,
  job_posting: job,
  candidate: { name: 'Maria Santos', headline: 'Data encoder', accommodations: [job.accommodations[0]] },
  status: 'pending',
  cover_note: 'I have 3 years of experience.',
  interview_request: 'Captions in the video call, please.',
  shortlisted_at: null,
  contacted_at: null,
  contact_confirmed_by: null,
  feedback_opens_on: null,
  created_at: '2026-10-03T10:00:00+08:00',
  updated_at: '2026-10-03T10:00:00+08:00',
};
