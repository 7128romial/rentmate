// localStorage helpers for the user profile and saved matches.
// In demo mode this is the source of truth; when wired to a real backend,
// these helpers can be swapped for fetch calls without touching the screens.

const PROFILE_KEY = 'rentmate_profile';
const MATCHES_KEY = 'rentmate_matches';

const DEFAULT_PROFILE = {
  name: '',
  city: 'תל אביב',
  budget: 5000,
  type: 'לבד',
  extras: 'מרפסת, שקט',
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* ignore quota errors */
  }
}

export function getProfile() {
  return { ...DEFAULT_PROFILE, ...readJSON(PROFILE_KEY, {}) };
}

export function setProfile(profile) {
  const merged = { ...getProfile(), ...profile };
  writeJSON(PROFILE_KEY, merged);
  return merged;
}

export function clearProfile() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch (e) {
    /* ignore */
  }
}

export function getMatches() {
  const list = readJSON(MATCHES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addMatch(property) {
  if (!property || !property.id) return getMatches();
  const list = getMatches();
  const existing = list.find((m) => String(m.id) === String(property.id));
  if (existing) return list;
  list.unshift({ ...property, matchedAt: new Date().toISOString() });
  writeJSON(MATCHES_KEY, list);
  return list;
}

export function removeMatch(id) {
  const list = getMatches().filter((m) => String(m.id) !== String(id));
  writeJSON(MATCHES_KEY, list);
  return list;
}

export function getMatch(id) {
  return getMatches().find((m) => String(m.id) === String(id)) || null;
}
