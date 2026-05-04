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

// Handle Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError(loginForm);
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  if (!email || !password) return;

  setButton(loginForm, 'מתחבר...', true);

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
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
    showError(loginForm, 'שגיאת תקשורת עם השרת');
    setButton(loginForm, 'התחבר', false);
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

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    const data = await res.json();
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
    showError(registerForm, 'שגיאת תקשורת עם השרת');
    setButton(registerForm, 'צור חשבון חדש', false);
  }
});
