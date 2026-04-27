import { API_BASE, DEMO_MODE, DEMO_OTP, setSession } from './src/config.js';
import { fakeSession } from './src/demo.js';
import { setRole } from './src/storage.js';

const loginForm = document.getElementById('login-form');
const otpForm = document.getElementById('otp-form');
const phoneInput = document.getElementById('phone-input');
const otpInput = document.getElementById('otp-input');
const roleButtons = document.querySelectorAll('.role-option');

let role = 'renter';

roleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    role = btn.dataset.role || 'renter';
    roleButtons.forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  });
});

function showError(input, message) {
  input.value = '';
  input.placeholder = message;
}

function landingFor(roleValue) {
  if (roleValue === 'landlord') return '/landlord.html';
  if (roleValue === 'roommate') return '/roommate_choice.html';
  return '/onboarding.html';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = phoneInput.value.trim();
  if (!phone) return;

  if (DEMO_MODE) {
    loginForm.classList.add('hidden');
    otpForm.classList.remove('hidden');
    otpInput.placeholder = `הזן ${DEMO_OTP} (דמו)`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      showError(phoneInput, 'שגיאה בשליחת הקוד');
      return;
    }
    loginForm.classList.add('hidden');
    otpForm.classList.remove('hidden');
  } catch (err) {
    console.error('API Error', err);
    showError(phoneInput, 'אין חיבור לשרת');
  }
});

otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = phoneInput.value.trim();
  const otp = otpInput.value.trim();

  if (DEMO_MODE) {
    if (otp !== DEMO_OTP) {
      showError(otpInput, `קוד דמו: ${DEMO_OTP}`);
      return;
    }
    setSession(fakeSession(phone));
    setRole(role);
    window.location.href = landingFor(role);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showError(otpInput, data.error || 'קוד שגוי, נסה שוב');
      return;
    }
    const data = await res.json();
    setSession({ user_id: data.user_id, token: data.token });
    setRole(role);
    window.location.href = landingFor(role);
  } catch (err) {
    console.error('API Error', err);
    showError(otpInput, 'אין חיבור לשרת');
  }
});
