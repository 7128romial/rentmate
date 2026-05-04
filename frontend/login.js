import { API_BASE, setSession } from './src/config.js';
import { setRole } from './src/storage.js';

// First-time visitors see the welcome screen.
if (!localStorage.getItem('rentmate_seen_welcome')) {
  window.location.replace('/welcome.html');
}

// UI Elements
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const loginEmailInput = document.getElementById('login-email');
const loginPasswordInput = document.getElementById('login-password');

const registerNameInput = document.getElementById('register-name');
const registerEmailInput = document.getElementById('register-email');
const registerPasswordInput = document.getElementById('register-password');

// Tab Switching Logic
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabRegister.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

tabRegister.addEventListener('click', () => {
  tabRegister.classList.add('active');
  tabLogin.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

function setButton(form, label, disabled) {
  const btn = form.querySelector('button[type=submit]');
  if (!btn) return;
  btn.disabled = disabled;
  btn.textContent = label;
}

function showError(form, message) {
  let banner = form.querySelector('.auth-error');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'auth-error';
    form.insertBefore(banner, form.firstChild);
  }
  banner.textContent = message;
  banner.hidden = false;
}

function clearError(form) {
  const banner = form.querySelector('.auth-error');
  if (banner) banner.hidden = true;
}

function destinationFor(data) {
  if (data && data.profile_complete) return '/swipe.html';
  return '/onboarding.html';
}

// Render's free tier sleeps after 15 min of inactivity; the first request
// after a wake-up can take 30-60s. Allow up to 75s before giving up.
const REQUEST_TIMEOUT_MS = 75_000;
// After this delay, swap the button label to a "still waking up" hint so the
// user knows we're not frozen.
const WAKE_HINT_MS = 4_000;

async function authFetch(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function startWakeHint(form, hintLabel) {
  const btn = form.querySelector('button[type=submit]');
  if (!btn) return () => {};
  const timer = setTimeout(() => {
    btn.textContent = hintLabel;
  }, WAKE_HINT_MS);
  return () => clearTimeout(timer);
}

function describeNetworkError(err) {
  if (err && err.name === 'AbortError') {
    return 'השרת לא הגיב בזמן. נסי שוב — לפעמים הוא צריך רגע להתעורר.';
  }
  return 'שגיאת תקשורת עם השרת. בדקי את החיבור לאינטרנט ונסי שוב.';
}

// Handle Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(loginForm);
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  if (!email || !password) return;

  setButton(loginForm, 'מתחבר...', true);
  const cancelHint = startWakeHint(loginForm, 'מעיר את השרת… (עד דקה)');

  try {
    const res = await authFetch(`${API_BASE}/api/auth/login`, { email, password });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(loginForm, data.error || 'התחברות נכשלה');
      setButton(loginForm, 'התחבר', false);
      return;
    }

    setSession({ user_id: data.user_id, token: data.token });
    if (data.role) setRole(data.role);
    window.location.href = destinationFor(data);

  } catch (err) {
    console.error('Login error', err);
    showError(loginForm, describeNetworkError(err));
    setButton(loginForm, 'התחבר', false);
  } finally {
    cancelHint();
  }
});

// Handle Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(registerForm);
  const name = registerNameInput.value.trim();
  const email = registerEmailInput.value.trim();
  const password = registerPasswordInput.value;

  if (!email || !password) return;

  setButton(registerForm, 'יוצר חשבון...', true);
  const cancelHint = startWakeHint(registerForm, 'מעיר את השרת… (עד דקה)');

  try {
    const res = await authFetch(`${API_BASE}/api/auth/register`, { email, password, name });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showError(registerForm, data.error || 'הרשמה נכשלה');
      setButton(registerForm, 'צור חשבון חדש', false);
      return;
    }

    setSession({ user_id: data.user_id, token: data.token });
    if (data.role) setRole(data.role);
    window.location.href = destinationFor(data);

  } catch (err) {
    console.error('Registration error', err);
    showError(registerForm, describeNetworkError(err));
    setButton(registerForm, 'צור חשבון חדש', false);
  } finally {
    cancelHint();
  }
});
