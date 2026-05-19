import { renderBottomNav } from './src/nav.js';
import { getRole, setRole, getSettings, setSettings } from './src/storage.js';
import { clearSession, API_BASE, authHeaders } from './src/config.js';

renderBottomNav('profile');

const accountMode = document.getElementById('setting-account-mode');
const notifications = document.getElementById('setting-notifications');
const language = document.getElementById('setting-language');
const privacyRadios = document.querySelectorAll('input[name="privacy"]');
const resetBtn = document.getElementById('reset-demo');

function load() {
  const s = getSettings();
  notifications.checked = !!s.notifications;
  language.value = s.language || 'he';
  privacyRadios.forEach((r) => {
    r.checked = r.value === (s.privacy || 'matches-only');
  });
  
  accountMode.value = getRole() || 'renter';
}

function showToast(text) {
  const existing = document.querySelector('.save-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1400);
}

accountMode.addEventListener('change', async () => {
  const newRole = accountMode.value;

  setRole(newRole);

  try {
    await fetch(`${API_BASE}/api/profile`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ role: newRole })
    });
  } catch (err) {
    console.error('Failed to sync new role', err);
  }
  
  showToast('מצב החשבון עודכן 🔄');
  setTimeout(() => {
     if (newRole === 'landlord') window.location.href = '/landlord.html';
     else window.location.href = '/swipe.html';
  }, 1000);
});

notifications.addEventListener('change', () => {
  setSettings({ notifications: notifications.checked });
  showToast('נשמר ✓');
});

language.addEventListener('change', () => {
  setSettings({ language: language.value });
  showToast('נשמר ✓');
});

privacyRadios.forEach((r) => {
  r.addEventListener('change', () => {
    if (r.checked) {
      setSettings({ privacy: r.value });
      showToast('נשמר ✓');
    }
  });
});

resetBtn.addEventListener('click', async () => {
  if (!confirm('לאפס את כל הנתונים המקומיים? זה ימחק את כל ההתאמות, ההודעות והפרופיל.')) return;
  
  try {
    await fetch(`${API_BASE}/api/reset`, {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (err) {
    console.error('Failed to reset backend data', err);
  }

  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('rentmate_'))
      .forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage)
      .filter((k) => k === 'rentmate_token' || k === 'rentmate_user_id')
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* ignore */
  }
  clearSession();
  window.location.href = '/';
});

load();
