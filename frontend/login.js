import { auth, RecaptchaVerifier, signInWithPhoneNumber } from './src/firebase.js';
import { API_BASE, DEMO_MODE, DEMO_OTP, setSession } from './src/config.js';
import { fakeSession } from './src/demo.js';

// First-time visitors see the welcome screen.
if (!localStorage.getItem('rentmate_seen_welcome')) {
  window.location.replace('/welcome.html');
}

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
  const old = document.getElementById('recaptcha-container');
  if (old && old.parentNode) old.parentNode.removeChild(old);
  const fresh = document.createElement('div');
  fresh.id = 'recaptcha-container';
  document.body.appendChild(fresh);
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

function showError(input, message) {
  input.value = '';
  input.placeholder = message;
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const phoneRaw = phoneInput.value.trim();
  if (!phoneRaw) return;

  if (DEMO_MODE) {
    loginForm.classList.add('hidden');
    otpForm.classList.remove('hidden');
    otpInput.placeholder = `הזן ${DEMO_OTP} (דמו)`;
    return;
  }

  const phone = normalizePhone(phoneRaw);
  console.log('[auth] normalized phone being sent to Firebase:', JSON.stringify(phone));
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

  if (DEMO_MODE) {
    if (otp !== DEMO_OTP) {
      showError(otpInput, `קוד דמו: ${DEMO_OTP}`);
      return;
    }
    const phone = normalizePhone(phoneInput.value.trim());
    setSession(fakeSession(phone));
    window.location.href = '/onboarding.html';
    return;
  }

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
      showError(otpInput, data.error || 'אימות נכשל');
      setButton(otpForm, 'אמת והתחבר', false);
      return;
    }
    const data = await res.json();
    setSession({ user_id: data.user_id, token: data.token });
    window.location.href = '/onboarding.html';
  } catch (err) {
    console.error('OTP verify failed', err);
    showError(otpInput, 'קוד שגוי, נסה שוב');
    setButton(otpForm, 'אמת והתחבר', false);
  }
});
