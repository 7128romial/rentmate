import { API_BASE, DEMO_MODE, DEMO_OTP, setSession } from './src/config.js';
import { fakeSession } from './src/demo.js';

const loginForm = document.getElementById('login-form');
const otpForm = document.getElementById('otp-form');
const phoneInput = document.getElementById('phone-input');
const otpInput = document.getElementById('otp-input');

function showError(input, message) {
  input.value = '';
  input.placeholder = message;
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
    window.location.href = '/onboarding.html';
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
    window.location.href = '/onboarding.html';
  } catch (err) {
    console.error('API Error', err);
    showError(otpInput, 'אין חיבור לשרת');
  }
});
