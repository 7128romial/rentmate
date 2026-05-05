import { renderBottomNav } from './src/nav.js';
import { getRole, getSubrole, setRole, setSubrole, getSettings, setSettings } from './src/storage.js';
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
  
  const currentRole = getRole() || 'renter';
  const currentSubrole = getSubrole();
  if (currentRole === 'roommate') {
     accountMode.value = currentSubrole === 'host' ? 'roommate_host' : 'roommate_seeker';
  } else {
     accountMode.value = currentRole;
  }
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
  const val = accountMode.value;
  let newRole = val;
  let newSubrole = null;
  if (val === 'roommate_host') {
    newRole = 'roommate';
    newSubrole = 'host';
  } else if (val === 'roommate_seeker') {
    newRole = 'roommate';
    newSubrole = 'seeker';
  }
  
  setRole(newRole);
  if (newSubrole) {
    setSubrole(newSubrole);
  }
  
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
     else if (newRole === 'roommate') window.location.href = newSubrole === 'host' ? '/roommate_host.html' : '/roommate_seeker.html';
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

resetBtn.addEventListener('click', () => {
  if (!confirm('לאפס את כל הנתונים המקומיים? זה ימחק את כל ההתאמות, ההודעות והפרופיל.')) return;
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
