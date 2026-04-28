import { renderBottomNav } from './src/nav.js';
import { addUserProperty, getRole } from './src/storage.js';

if (getRole() !== 'landlord') {
  window.location.replace('/swipe.html');
}

renderBottomNav('landlord');

const form = document.getElementById('property-form');
const get = (id) => document.getElementById(id).value.trim();
const getInt = (id, fallback) => {
  const n = parseInt(get(id), 10);
  return Number.isFinite(n) ? n : fallback;
};
const getFloat = (id, fallback) => {
  const n = parseFloat(get(id));
  return Number.isFinite(n) ? n : fallback;
};

function listFromTextarea(value) {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const price = getInt('p-price', 0);
  const property = {
    title: get('p-title'),
    price: `₪${price.toLocaleString('he-IL')}/חודש`,
    location: get('p-address'),
    address: get('p-address'),
    image:
      get('p-image') ||
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80',
    matchScore: 95,
    tags: get('p-tags')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    rooms: getFloat('p-rooms', null),
    area: getInt('p-area', null),
    floor: getInt('p-floor', null),
    totalFloors: getInt('p-total-floors', null),
    available: get('p-available'),
    description: get('p-description'),
    amenities: listFromTextarea(document.getElementById('p-amenities').value),
    nearby: [],
    kind: 'apartment',
  };

  if (!property.title || !price || !property.address) {
    alert('יש למלא כותרת, מחיר וכתובת.');
    return;
  }

  addUserProperty(property);
  window.location.href = '/landlord.html';
});
