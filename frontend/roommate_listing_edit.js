import { renderBottomNav } from './src/nav.js';
import { DEMO_MY_LISTING } from './src/demo.js';
import { getRole, getSubrole, getUserListing, setUserListing } from './src/storage.js';

if (getRole() !== 'roommate' || getSubrole() !== 'host') {
  window.location.replace('/roommate_choice.html');
}

renderBottomNav('roommate-host');

const form = document.getElementById('listing-form');
const get = (id) => document.getElementById(id).value.trim();
const getInt = (id, fallback) => {
  const n = parseInt(get(id), 10);
  return Number.isFinite(n) ? n : fallback;
};
const getFloat = (id, fallback) => {
  const n = parseFloat(get(id));
  return Number.isFinite(n) ? n : fallback;
};

function load() {
  const existing = getUserListing() || DEMO_MY_LISTING;
  document.getElementById('l-title').value = existing.title || '';
  const numericPrice = parseInt(String(existing.price || '').replace(/[^\d]/g, ''), 10);
  document.getElementById('l-price').value = Number.isFinite(numericPrice) ? numericPrice : '';
  document.getElementById('l-address').value = existing.address || '';
  document.getElementById('l-rooms').value = existing.rooms != null ? existing.rooms : '';
  document.getElementById('l-area').value = existing.area != null ? existing.area : '';
  document.getElementById('l-available').value = existing.available || '';
  document.getElementById('l-image').value = existing.image || '';
  document.getElementById('l-tags').value = (existing.tags || []).join(', ');
  document.getElementById('l-description').value = existing.description || '';

  const host = existing.host || {};
  document.getElementById('h-name').value = host.name && host.name !== 'אני' ? host.name : '';
  document.getElementById('h-age').value = host.age != null ? host.age : '';
  document.getElementById('h-occupation').value = host.occupation || '';
  document.getElementById('h-lifestyle').value = host.lifestyle || '';
  document.getElementById('h-photo').value = host.photo || '';
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const price = getInt('l-price', 0);
  const listing = {
    id: 'my-listing',
    title: get('l-title'),
    price: `₪${price.toLocaleString('he-IL')}/חודש`,
    address: get('l-address'),
    location: get('l-address'),
    image:
      get('l-image') ||
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
    matchScore: 95,
    tags: get('l-tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    rooms: getFloat('l-rooms', null),
    area: getInt('l-area', null),
    available: get('l-available'),
    description: get('l-description'),
    amenities: [],
    nearby: [],
    kind: 'shared',
    host: {
      name: get('h-name') || 'אני',
      age: getInt('h-age', null),
      occupation: get('h-occupation'),
      lifestyle: get('h-lifestyle'),
      photo: get('h-photo'),
    },
  };

  if (!listing.title || !price || !listing.address) {
    alert('יש למלא כותרת, מחיר וכתובת.');
    return;
  }

  setUserListing(listing);
  window.location.href = '/roommate_host.html';
});

load();
