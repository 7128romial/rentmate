import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from './src/firebase.js';
import { API_BASE, DEMO_MODE, setSession } from './src/config.js';
import { fakeSession } from './src/demo.js';

// First-time visitors see the welcome screen.
if (!localStorage.getItem('rentmate_seen_welcome')) {
  window.location.replace('/welcome.html');
}

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');

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
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;

  if (DEMO_MODE) {
    if (password !== '1234') {
      showError(passwordInput, 'סיסמת דמו היא 1234');
      return;
    }
    setSession(fakeSession(email));
    window.location.href = '/onboarding.html';
    return;
  }

  setButton(loginForm, 'מתחבר...', true);
  try {
    let cred;
    try {
      // Try to sign in first
      cred = await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      // If user not found, create a new one
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          cred = await createUserWithEmailAndPassword(auth, email, password);
        } catch (createErr) {
          throw createErr;
        }
      } else {
        throw err;
      }
    }

    const idToken = await cred.user.getIdToken();
    const res = await fetch(`${API_BASE}/api/auth/firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showError(passwordInput, data.error || 'התחברות נכשלה מול השרת');
      setButton(loginForm, 'התחבר / הירשם', false);
      return;
    }
    
    const data = await res.json();
    setSession({ user_id: data.user_id, token: data.token });
    window.location.href = '/onboarding.html';

  } catch (err) {
    console.error('Firebase Auth failed', err);
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      showError(passwordInput, 'סיסמה שגויה');
    } else if (err.code === 'auth/weak-password') {
      showError(passwordInput, 'סיסמה חלשה מדי (לפחות 6 תווים)');
    } else if (err.code === 'auth/email-already-in-use') {
      showError(emailInput, 'אימייל זה כבר בשימוש');
    } else {
      alert('שגיאה בהתחברות: ' + (err.message || err));
    }
    setButton(loginForm, 'התחבר / הירשם', false);
  }
});
