import { renderBottomNav } from './src/nav.js';
import { getSettings, setSettings } from './src/storage.js';
import { clearSession } from './src/config.js';

renderBottomNav('profile');

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
