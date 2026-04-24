import { API_BASE, setSession } from './src/config.js';

const loginForm = document.getElementById('login-form');
const otpForm = document.getElementById('otp-form');
const phoneInput = document.getElementById('phone-input');
const otpInput = document.getElementById('otp-input');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = phoneInput.value.trim();
  if (!phone) return;
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      console.error('login failed', res.status);
      return;
    }
    loginForm.classList.add('hidden');
    otpForm.classList.remove('hidden');
  } catch (err) {
    console.error('API Error', err);
  }
});

otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = phoneInput.value.trim();
  const otp = otpInput.value.trim();
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      otpInput.value = '';
      otpInput.placeholder = data.error || 'קוד שגוי, נסה שוב';
      return;
    }
    const data = await res.json();
    setSession({ user_id: data.user_id, token: data.token });
    window.location.href = '/onboarding.html';
  } catch (err) {
    console.error('API Error', err);
  }
});
