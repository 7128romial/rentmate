import { auth, RecaptchaVerifier, signInWithPhoneNumber } from './src/firebase.js';
import { API_BASE, setSession } from './src/config.js';

const loginForm = document.getElementById('login-form');
const otpForm = document.getElementById('otp-form');
const phoneInput = document.getElementById('phone-input');
const otpInput = document.getElementById('otp-input');

let recaptchaVerifier = null;
let confirmationResult = null;

function createRecaptcha() {
  if (recaptchaVerifier) {
    try { recaptchaVerifier.clear(); } catch (_) {}
    recaptchaVerifier = null;
  }
  const container = document.getElementById('recaptcha-container');
  if (container) container.innerHTML = '';
  recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    size: 'invisible',
  });
  return recaptchaVerifier;
}

function normalizePhone(raw) {
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('0')) return '+972' + p.slice(1);
  if (!p.startsWith('+')) return '+' + p;
  return p;
}

function setButton(form, label, disabled) {
  const btn = form.querySelector('button[type=submit]');
  if (!btn) return;
  btn.disabled = disabled;
  btn.textContent = label;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = normalizePhone(phoneInput.value.trim());
  if (!phone) return;
  setButton(loginForm, 'שולח...', true);
  try {
    const verifier = createRecaptcha();
    confirmationResult = await signInWithPhoneNumber(auth, phone, verifier);
    loginForm.classList.add('hidden');
    otpForm.classList.remove('hidden');
    setButton(loginForm, 'שלח קוד ב-SMS', false);
  } catch (err) {
    console.error('Firebase signInWithPhoneNumber failed', err);
    alert('שגיאה בשליחת הקוד: ' + (err.message || err));
    setButton(loginForm, 'שלח קוד ב-SMS', false);
    try { recaptchaVerifier && recaptchaVerifier.clear(); } catch (_) {}
    recaptchaVerifier = null;
  }
});

otpForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const otp = otpInput.value.trim();
  if (!otp || !confirmationResult) return;
  setButton(otpForm, 'מאמת...', true);
  try {
    const cred = await confirmationResult.confirm(otp);
    const idToken = await cred.user.getIdToken();
    const res = await fetch(`${API_BASE}/api/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      otpInput.value = '';
      otpInput.placeholder = data.error || 'אימות נכשל';
      setButton(otpForm, 'אמת והתחבר', false);
      return;
    }
    const data = await res.json();
    setSession({ user_id: data.user_id, token: data.token });
    window.location.href = '/onboarding.html';
  } catch (err) {
    console.error('OTP verify failed', err);
    otpInput.value = '';
    otpInput.placeholder = 'קוד שגוי, נסה שוב';
    setButton(otpForm, 'אמת והתחבר', false);
  }
});
