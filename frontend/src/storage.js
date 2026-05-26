// localStorage helpers for the client-side profile, saved matches and
// settings. Backend-backed data (properties, interests, subscription) is
// fetched through the async helpers further down this file.

const PROFILE_KEY = 'rentmate_profile';
const MATCHES_KEY = 'rentmate_matches';
const ROLE_KEY = 'rentmate_role';
const USER_PROPERTIES_KEY = 'rentmate_user_properties';
const FILTER_PREFS_KEY = 'rentmate_filter_prefs';
const CHAT_MESSAGES_PREFIX = 'rentmate_chat_';
const SETTINGS_KEY = 'rentmate_settings';
const SUBSCRIPTION_KEY = 'rentmate_subscription';
const DAILY_SWIPES_KEY = 'rentmate_daily_swipes';

export const FREE_DAILY_SWIPE_LIMIT = 2;

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

// Pulls the canonical match list from the backend (landlord-approved
// matches live there, not in localStorage) and merges into local cache.
// Server fields win on conflict; local-only matches are kept so demo
// mode and any in-flight state aren't lost.
export async function syncMatchesFromBackend() {
  const { API_BASE, getToken } = await import('./config.js');
  const token = getToken();
  if (!token) return getMatches();

  try {
    const res = await fetch(`${API_BASE}/api/matches`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return getMatches();
    const serverMatches = await res.json();
    if (!Array.isArray(serverMatches)) return getMatches();

    const local = getMatches();
    const byId = new Map();
    local.forEach((m) => {
      if (m && m.id != null) byId.set(String(m.id), m);
    });
    serverMatches.forEach((m) => {
      if (!m || m.id == null) return;
      const key = String(m.id);
      const existing = byId.get(key) || {};
      byId.set(key, {
        ...existing,
        ...m,
        matchedAt: m.matchedAt || existing.matchedAt || new Date().toISOString(),
      });
    });
    const merged = Array.from(byId.values());
    writeJSON(MATCHES_KEY, merged);
    return merged;
  } catch (e) {
    console.error('syncMatchesFromBackend failed', e);
    return getMatches();
  }
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
    if (role === 'landlord' || role === 'renter' || role === 'roommate') {
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

// --- Landlord-side decisions on interested renters (backend-driven) ---

async function postDecision(path, propertyId, renterId) {
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ property_id: propertyId, renter_id: renterId }),
    });
    return res.ok;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function approveRenter(propertyId, renterId) {
  return postDecision('/api/landlord/approve', propertyId, renterId);
}

export function rejectRenter(propertyId, renterId) {
  return postDecision('/api/landlord/reject', propertyId, renterId);
}

export function undoRenterDecision(propertyId, renterId) {
  return postDecision('/api/landlord/reopen', propertyId, renterId);
}

// Renters who showed interest in a property, grouped by status.
export async function getPropertyInterests(propertyId) {
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(
      `${API_BASE}/api/landlord/properties/${propertyId}/interests`,
      { headers: authHeaders() },
    );
    if (res.ok) return await res.json();
  } catch (e) {
    console.error(e);
  }
  return { pending: [], approved: [], rejected: [] };
}


// --- User-created properties (landlord adds one or more) ---

export async function getUserProperties() {
  if (getRole() !== 'landlord') return [];
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(`${API_BASE}/api/landlord/properties`, { headers: authHeaders() });
    if (res.ok) {
      return await res.json();
    }
  } catch(e) {
    console.error(e);
  }
  return [];
}

export const PROPERTY_STATUSES = ['available', 'rented', 'pending', 'off_market'];

export async function addUserProperty(property) {
  if (!property) return { ok: false, error: 'No property data' };
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(`${API_BASE}/api/properties`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(property),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: true, id: data && data.id };
    }
    if (res.status === 401) return { ok: false, status: 401, error: 'Unauthorized' };
    let errMsg = `שגיאה ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) errMsg = body.error;
    } catch (e) { /* ignore */ }
    return { ok: false, status: res.status, error: errMsg };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'שגיאת תקשורת' };
  }
}

export async function updateUserProperty(id, patch) {
  if (!id || !patch) return { ok: false, error: 'No data' };
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(`${API_BASE}/api/landlord/properties/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(patch),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, status: 401, error: 'Unauthorized' };
    let errMsg = `שגיאה ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) errMsg = body.error;
    } catch (e) { /* ignore */ }
    return { ok: false, status: res.status, error: errMsg };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'שגיאת תקשורת' };
  }
}

export async function setUserPropertyStatus(id, status) {
  if (!PROPERTY_STATUSES.includes(status)) return;
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    await fetch(`${API_BASE}/api/landlord/properties/${id}/status`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
  } catch(e) {
    console.error(e);
  }
}

export async function removeUserProperty(id) {
  if (!id) return { ok: false, error: 'No id' };
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(`${API_BASE}/api/landlord/properties/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, status: 401, error: 'Unauthorized' };
    let errMsg = `שגיאה ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.error) errMsg = body.error;
    } catch (e) { /* ignore */ }
    return { ok: false, status: res.status, error: errMsg };
  } catch (e) {
    console.error(e);
    return { ok: false, error: 'שגיאת תקשורת' };
  }
}



// --- Filter prefs (renter pre-swipe filter) ---

const DEFAULT_FILTERS = {
  area: '',
  minPrice: 0,
  maxPrice: 10000,
  minRooms: 0,
};

export function getFilterPrefs() {
  return { ...DEFAULT_FILTERS, ...(readJSON(FILTER_PREFS_KEY, {}) || {}) };
}

export function setFilterPrefs(prefs) {
  const merged = { ...getFilterPrefs(), ...prefs };
  writeJSON(FILTER_PREFS_KEY, merged);
  return merged;
}

export function clearFilterPrefs() {
  try {
    localStorage.removeItem(FILTER_PREFS_KEY);
  } catch (e) {
    /* ignore */
  }
}

// --- Chat messages (per chat-id, e.g. property:42) ---

function chatKey(chatId) {
  return `${CHAT_MESSAGES_PREFIX}${chatId}`;
}

export function getChatMessages(chatId) {
  if (!chatId) return [];
  const list = readJSON(chatKey(chatId), []);
  return Array.isArray(list) ? list : [];
}

export function addChatMessage(chatId, message) {
  if (!chatId || !message) return getChatMessages(chatId);
  const list = getChatMessages(chatId);
  list.push({
    role: message.role || 'user',
    content: String(message.content || ''),
    ts: new Date().toISOString(),
  });
  writeJSON(chatKey(chatId), list);
  return list;
}

export function clearChatMessages(chatId) {
  if (!chatId) return;
  try {
    localStorage.removeItem(chatKey(chatId));
  } catch (e) {
    /* ignore */
  }
}

// --- Subscription tier (free | pro) and daily swipe quota ---

export function getSubscription() {
  try {
    const v = localStorage.getItem(SUBSCRIPTION_KEY);
    return v === 'pro' ? 'pro' : 'free';
  } catch (e) {
    return 'free';
  }
}

export function setSubscription(tier) {
  try {
    localStorage.setItem(SUBSCRIPTION_KEY, tier === 'pro' ? 'pro' : 'free');
  } catch (e) {
    /* ignore */
  }
  return getSubscription();
}

// Pull authoritative subscription state from the backend and mirror to
// localStorage. Safe to fire-and-forget — getSubscription() stays sync.
export async function syncSubscriptionFromBackend() {
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    const res = await fetch(`${API_BASE}/api/subscription`, { headers: authHeaders() });
    if (!res.ok) return getSubscription();
    const data = await res.json();
    const tier = data && data.tier === 'pro' ? 'pro' : 'free';
    try { localStorage.setItem(SUBSCRIPTION_KEY, tier); } catch (e) { /* ignore */ }
    return tier;
  } catch (e) {
    return getSubscription();
  }
}

export async function cancelSubscriptionOnBackend() {
  try {
    const { API_BASE, authHeaders } = await import('./config.js');
    await fetch(`${API_BASE}/api/subscription/cancel`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch (e) {
    /* ignore */
  }
  try { localStorage.setItem(SUBSCRIPTION_KEY, 'free'); } catch (e) { /* ignore */ }
  return 'free';
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailySwipeCount() {
  const data = readJSON(DAILY_SWIPES_KEY, null);
  if (!data || data.date !== todayKey()) return 0;
  return Number(data.count) || 0;
}

export function incrementDailySwipeCount() {
  const date = todayKey();
  const current = getDailySwipeCount();
  const next = current + 1;
  writeJSON(DAILY_SWIPES_KEY, { date, count: next });
  return next;
}

export function canSwipeToday() {
  if (getSubscription() === 'pro') return true;
  return getDailySwipeCount() < FREE_DAILY_SWIPE_LIMIT;
}

export function remainingSwipesToday() {
  if (getSubscription() === 'pro') return Infinity;
  return Math.max(0, FREE_DAILY_SWIPE_LIMIT - getDailySwipeCount());
}

// --- App settings ---

const DEFAULT_SETTINGS = {
  notifications: true,
  language: 'he',
  privacy: 'matches-only', // 'public' | 'matches-only' | 'hidden'
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(readJSON(SETTINGS_KEY, {}) || {}) };
}

export function setSettings(patch) {
  const merged = { ...getSettings(), ...patch };
  writeJSON(SETTINGS_KEY, merged);
  return merged;
}
