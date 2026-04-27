import { clearSession } from './src/config.js';
import { renderBottomNav } from './src/nav.js';
import { clearProfile, clearRole, clearSubrole, getProfile, setProfile } from './src/storage.js';

renderBottomNav('profile');

const form = document.getElementById('profile-form');
const fields = {
  name: document.getElementById('field-name'),
  city: document.getElementById('field-city'),
  budget: document.getElementById('field-budget'),
  type: document.getElementById('field-type'),
  extras: document.getElementById('field-extras'),
};

function load() {
  const profile = getProfile();
  fields.name.value = profile.name || '';
  fields.city.value = profile.city || '';
  fields.budget.value = profile.budget != null ? profile.budget : '';
  fields.type.value = profile.type || 'לבד';
  fields.extras.value = profile.extras || '';
}

function showToast(text) {
  const existing = document.querySelector('.save-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'save-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1600);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const budget = parseInt(fields.budget.value, 10);
  setProfile({
    name: fields.name.value.trim(),
    city: fields.city.value.trim(),
    budget: Number.isFinite(budget) ? budget : 0,
    type: fields.type.value,
    extras: fields.extras.value.trim(),
  });
  showToast('נשמר ✓');
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  clearProfile();
  clearRole();
  clearSubrole();
  window.location.href = '/';
});

load();
