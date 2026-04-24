const fallback = 'https://rentmate-backend-0l8z.onrender.com';
export const API_BASE = (import.meta.env && import.meta.env.VITE_API_BASE) || fallback;

const TOKEN_KEY = 'rentmate_token';
const USER_ID_KEY = 'rentmate_user_id';

export function setSession({ user_id, token }) {
  if (user_id != null) localStorage.setItem(USER_ID_KEY, String(user_id));
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function getUserId() {
  return localStorage.getItem(USER_ID_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}
