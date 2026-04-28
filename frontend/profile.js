import { clearSession } from './src/config.js';
import { renderBottomNav } from './src/nav.js';
import {
  clearProfile,
  clearRole,
  clearSubrole,
  clearUserListing,
  getProfile,
  getRole,
  getSubrole,
  getUserListing,
  setProfile,
  setUserListing,
} from './src/storage.js';

const role = getRole();
const subrole = getSubrole();

renderBottomNav('profile');

const titleEl = document.getElementById('profile-title');
const subtitleEl = document.getElementById('profile-subtitle');
const form = document.getElementById('profile-form');

if (role === 'landlord') {
  titleEl.textContent = 'הפרופיל שלי';
  subtitleEl.textContent = 'פרטי המשכיר/ה — מופיעים לשוכרים שמתעניינים בדירות שלך.';
} else if (role === 'roommate' && subrole === 'host') {
  titleEl.textContent = 'הפרופיל וליסטינג';
  subtitleEl.textContent = 'הפרטים שאחרים יראו עליך ועל החדר.';
} else if (role === 'roommate' && subrole === 'seeker') {
  titleEl.textContent = 'הפרופיל שלי';
  subtitleEl.textContent = 'הפרטים שמופיעים לשותפים פוטנציאליים.';
} else {
  titleEl.textContent = 'הפרופיל שלי';
  subtitleEl.textContent = 'הפרטים האלה משמשים להתאמת דירות מדויקת יותר.';
}

// --- helpers to declaratively build form fields ---

function field(id, label, { type = 'text', placeholder = '', value = '', options = null, multiline = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'profile-field';
  const lab = document.createElement('label');
  lab.htmlFor = id;
  lab.textContent = label;
  let input;
  if (options) {
    input = document.createElement('select');
    input.className = 'profile-input';
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      input.appendChild(o);
    });
    input.value = value || '';
  } else if (multiline) {
    input = document.createElement('textarea');
    input.className = 'profile-textarea';
    input.placeholder = placeholder;
    input.value = value || '';
  } else {
    input = document.createElement('input');
    input.className = 'profile-input';
    input.type = type;
    input.placeholder = placeholder;
    if (value !== undefined && value !== null) input.value = value;
  }
  input.id = id;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  form.appendChild(wrap);
  return input;
}

function sectionTitle(text) {
  const h = document.createElement('h2');
  h.className = 'form-section-title';
  h.textContent = text;
  form.appendChild(h);
}

function actions({ extraButton = null } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'profile-actions';

  const save = document.createElement('button');
  save.className = 'btn-primary';
  save.type = 'submit';
  save.textContent = 'שמור שינויים';
  wrap.appendChild(save);

  if (extraButton) wrap.appendChild(extraButton);

  const settings = document.createElement('a');
  settings.className = 'btn-ghost';
  settings.href = '/settings.html';
  settings.textContent = 'הגדרות';
  wrap.appendChild(settings);

  const logout = document.createElement('button');
  logout.className = 'btn-ghost';
  logout.type = 'button';
  logout.textContent = 'התנתק';
  logout.addEventListener('click', () => {
    clearSession();
    clearProfile();
    clearRole();
    clearSubrole();
    clearUserListing();
    window.location.href = '/';
  });
  wrap.appendChild(logout);

  form.appendChild(wrap);
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

// --- per-role rendering ---

const profile = getProfile();

if (role === 'landlord') {
  renderLandlord();
} else if (role === 'roommate' && subrole === 'host') {
  renderHost();
} else if (role === 'roommate' && subrole === 'seeker') {
  renderSeeker();
} else {
  renderRenter();
}

function renderRenter() {
  const f = {
    name: field('field-name', 'שם', { placeholder: 'איך לקרוא לך?', value: profile.name }),
    city: field('field-city', 'עיר', { placeholder: 'תל אביב', value: profile.city }),
    budget: field('field-budget', 'תקציב חודשי (₪)', { type: 'number', placeholder: '5000', value: profile.budget }),
    type: field('field-type', 'סוג מגורים', { options: ['לבד', 'זוג', 'שותפים', 'משפחה'], value: profile.type }),
    extras: field('field-extras', 'דרישות נוספות', { placeholder: 'מרפסת, חניה, חיות...', multiline: true, value: profile.extras }),
  };
  actions();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const budget = parseInt(f.budget.value, 10);
    setProfile({
      name: f.name.value.trim(),
      city: f.city.value.trim(),
      budget: Number.isFinite(budget) ? budget : 0,
      type: f.type.value,
      extras: f.extras.value.trim(),
    });
    showToast('נשמר ✓');
  });
}

function renderSeeker() {
  const f = {
    name: field('field-name', 'שם', { placeholder: 'איך לקרוא לך?', value: profile.name }),
    city: field('field-city', 'עיר/אזור מועדף', { placeholder: 'תל אביב מרכז', value: profile.city }),
    budget: field('field-budget', 'תקציב לחדר (₪)', { type: 'number', placeholder: '2500', value: profile.budget }),
    moveIn: field('field-move-in', 'מועד מעבר', { placeholder: 'מיידית / 1 ביולי', value: profile.moveIn }),
    extras: field('field-extras', 'אורח חיים', { placeholder: 'שקט/חברתי/עובד מהבית/יוצא הרבה', multiline: true, value: profile.extras }),
  };
  actions();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const budget = parseInt(f.budget.value, 10);
    setProfile({
      name: f.name.value.trim(),
      city: f.city.value.trim(),
      budget: Number.isFinite(budget) ? budget : 0,
      moveIn: f.moveIn.value.trim(),
      extras: f.extras.value.trim(),
    });
    showToast('נשמר ✓');
  });
}

function renderHost() {
  const listing = getUserListing() || {};
  const host = listing.host || {};

  sectionTitle('עליי');
  const f = {
    name: field('field-name', 'שם', { placeholder: 'איך לקרוא לך?', value: host.name && host.name !== 'אני' ? host.name : profile.name || '' }),
    age: field('field-age', 'גיל', { type: 'number', placeholder: '28', value: host.age != null ? host.age : '' }),
    occupation: field('field-occupation', 'עיסוק', { placeholder: 'מעצבת UI', value: host.occupation }),
    lifestyle: field('field-lifestyle', 'אורח חיים', { placeholder: 'שעות עבודה, חיות, הרגלים...', multiline: true, value: host.lifestyle }),
    photo: field('field-photo', 'קישור לתמונה', { type: 'url', placeholder: 'https://...', value: host.photo }),
  };

  sectionTitle('הליסטינג');
  const editLink = document.createElement('a');
  editLink.className = 'btn-ghost';
  editLink.href = '/roommate_listing_edit.html';
  editLink.textContent = 'ערוך פרטי דירה וחדר';
  editLink.style.alignSelf = 'flex-start';
  form.appendChild(editLink);

  actions();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const ageRaw = parseInt(f.age.value, 10);
    setProfile({ name: f.name.value.trim() });
    setUserListing({
      ...(getUserListing() || {}),
      host: {
        name: f.name.value.trim() || 'אני',
        age: Number.isFinite(ageRaw) ? ageRaw : null,
        occupation: f.occupation.value.trim(),
        lifestyle: f.lifestyle.value.trim(),
        photo: f.photo.value.trim(),
      },
    });
    showToast('נשמר ✓');
  });
}

function renderLandlord() {
  const f = {
    name: field('field-name', 'שם', { placeholder: 'איך לקרוא לך?', value: profile.name }),
    city: field('field-city', 'אזורי פעילות', { placeholder: 'תל אביב, מרכז', value: profile.city }),
    priceRange: field('field-price-range', 'טווח מחירים', { placeholder: '₪3000-5000', value: profile.priceRange }),
    numProperties: field('field-num', 'כמה דירות יש לך', { options: ['רק אחת', '2-3', '4-10', '10+'], value: profile.numProperties }),
    bio: field('field-bio', 'קצת עליך', { placeholder: 'משכיר/ה דירות באזור מרכז כבר 5 שנים...', multiline: true, value: profile.bio }),
  };
  actions();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    setProfile({
      name: f.name.value.trim(),
      city: f.city.value.trim(),
      priceRange: f.priceRange.value.trim(),
      numProperties: f.numProperties.value,
      bio: f.bio.value.trim(),
    });
    showToast('נשמר ✓');
  });
}
