// localStorage helpers for the user profile and saved matches.
// In demo mode this is the source of truth; when wired to a real backend,
// these helpers can be swapped for fetch calls without touching the screens.

const PROFILE_KEY = 'rentmate_profile';
const MATCHES_KEY = 'rentmate_matches';
const ROLE_KEY = 'rentmate_role';
const SUBROLE_KEY = 'rentmate_subrole';
const LANDLORD_REJECTED_KEY = 'rentmate_landlord_rejected';
const LANDLORD_APPROVED_KEY = 'rentmate_landlord_approved';
const ROOMMATE_MATCHES_KEY = 'rentmate_roommate_matches';
const ROOMMATE_HOST_APPROVED_KEY = 'rentmate_host_approved';
const ROOMMATE_HOST_REJECTED_KEY = 'rentmate_host_rejected';

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

// --- Role ---

export function getRole() {
  try {
    return localStorage.getItem(ROLE_KEY) || 'renter';
  } catch (e) {
    return 'renter';
  }
}

export function setRole(role) {
  try {
    if (role === 'landlord' || role === 'renter') {
      localStorage.setItem(ROLE_KEY, role);
    }
  } catch (e) {
    /* ignore */
  }
}

export function clearRole() {
  try {
    localStorage.removeItem(ROLE_KEY);
  } catch (e) {
    /* ignore */
  }
}

// --- Landlord-side decisions on interested renters ---

function readSet(key) {
  const arr = readJSON(key, []);
  return new Set(Array.isArray(arr) ? arr.map(String) : []);
}

function writeSet(key, set) {
  writeJSON(key, Array.from(set));
}

function decisionKey(propertyId, renterId) {
  return `${propertyId}::${renterId}`;
}

export function approveRenter(propertyId, renterId) {
  const approved = readSet(LANDLORD_APPROVED_KEY);
  const rejected = readSet(LANDLORD_REJECTED_KEY);
  const key = decisionKey(propertyId, renterId);
  approved.add(key);
  rejected.delete(key);
  writeSet(LANDLORD_APPROVED_KEY, approved);
  writeSet(LANDLORD_REJECTED_KEY, rejected);
}

export function rejectRenter(propertyId, renterId) {
  const approved = readSet(LANDLORD_APPROVED_KEY);
  const rejected = readSet(LANDLORD_REJECTED_KEY);
  const key = decisionKey(propertyId, renterId);
  rejected.add(key);
  approved.delete(key);
  writeSet(LANDLORD_APPROVED_KEY, approved);
  writeSet(LANDLORD_REJECTED_KEY, rejected);
}

export function undoRenterDecision(propertyId, renterId) {
  const approved = readSet(LANDLORD_APPROVED_KEY);
  const rejected = readSet(LANDLORD_REJECTED_KEY);
  const key = decisionKey(propertyId, renterId);
  approved.delete(key);
  rejected.delete(key);
  writeSet(LANDLORD_APPROVED_KEY, approved);
  writeSet(LANDLORD_REJECTED_KEY, rejected);
}

export function getRenterDecision(propertyId, renterId) {
  const key = decisionKey(propertyId, renterId);
  if (readSet(LANDLORD_APPROVED_KEY).has(key)) return 'approved';
  if (readSet(LANDLORD_REJECTED_KEY).has(key)) return 'rejected';
  return 'pending';
}

// --- Roommate sub-role (host vs seeker) ---

export function getSubrole() {
  try {
    return localStorage.getItem(SUBROLE_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setSubrole(value) {
  try {
    if (value === 'host' || value === 'seeker') {
      localStorage.setItem(SUBROLE_KEY, value);
    }
  } catch (e) {
    /* ignore */
  }
}

export function clearSubrole() {
  try {
    localStorage.removeItem(SUBROLE_KEY);
  } catch (e) {
    /* ignore */
  }
}

// --- Roommate seeker: matches with other people ---

export function getRoommateMatches() {
  const list = readJSON(ROOMMATE_MATCHES_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addRoommateMatch(person) {
  if (!person || !person.id) return getRoommateMatches();
  const list = getRoommateMatches();
  if (list.some((p) => String(p.id) === String(person.id))) return list;
  list.unshift({ ...person, matchedAt: new Date().toISOString() });
  writeJSON(ROOMMATE_MATCHES_KEY, list);
  return list;
}

export function removeRoommateMatch(id) {
  const list = getRoommateMatches().filter((p) => String(p.id) !== String(id));
  writeJSON(ROOMMATE_MATCHES_KEY, list);
  return list;
}

// --- Roommate host: decisions about interested seekers ---

export function approveHostInterest(personId) {
  const approved = readSet(ROOMMATE_HOST_APPROVED_KEY);
  const rejected = readSet(ROOMMATE_HOST_REJECTED_KEY);
  approved.add(String(personId));
  rejected.delete(String(personId));
  writeSet(ROOMMATE_HOST_APPROVED_KEY, approved);
  writeSet(ROOMMATE_HOST_REJECTED_KEY, rejected);
}

export function rejectHostInterest(personId) {
  const approved = readSet(ROOMMATE_HOST_APPROVED_KEY);
  const rejected = readSet(ROOMMATE_HOST_REJECTED_KEY);
  rejected.add(String(personId));
  approved.delete(String(personId));
  writeSet(ROOMMATE_HOST_APPROVED_KEY, approved);
  writeSet(ROOMMATE_HOST_REJECTED_KEY, rejected);
}

export function undoHostInterest(personId) {
  const approved = readSet(ROOMMATE_HOST_APPROVED_KEY);
  const rejected = readSet(ROOMMATE_HOST_REJECTED_KEY);
  approved.delete(String(personId));
  rejected.delete(String(personId));
  writeSet(ROOMMATE_HOST_APPROVED_KEY, approved);
  writeSet(ROOMMATE_HOST_REJECTED_KEY, rejected);
}

export function getHostInterestDecision(personId) {
  if (readSet(ROOMMATE_HOST_APPROVED_KEY).has(String(personId))) return 'approved';
  if (readSet(ROOMMATE_HOST_REJECTED_KEY).has(String(personId))) return 'rejected';
  return 'pending';
}
