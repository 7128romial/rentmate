import { renderBottomNav } from './src/nav.js';
import { addUserProperty, getRole } from './src/storage.js';
import { API_BASE, authHeaders } from './src/config.js';

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

  const priceMin = getInt('p-price-min', 0);
  const priceMax = getInt('p-price-max', 0);
  const lo = Math.min(priceMin, priceMax);
  const hi = Math.max(priceMin, priceMax);

  const priceLabel = lo === hi
    ? `₪${lo.toLocaleString('he-IL')}/חודש`
    : `₪${lo.toLocaleString('he-IL')}–${hi.toLocaleString('he-IL')}/חודש`;

  const property = {
    title: get('p-title'),
    priceMin: lo,
    priceMax: hi,
    price: priceLabel,
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
    status: 'available',
  };

  if (!property.title || !lo || !hi || !property.address) {
    alert('יש למלא כותרת, טווח מחיר וכתובת.');
    return;
  }

  addUserProperty(property);
  window.location.href = '/landlord.html';
});

// --- AI assist: chat that auto-fills the form via OpenAI function calling ---

const FIELD_MAP = {
  title: 'p-title',
  price_min: 'p-price-min',
  price_max: 'p-price-max',
  address: 'p-address',
  rooms: 'p-rooms',
  area: 'p-area',
  floor: 'p-floor',
  total_floors: 'p-total-floors',
  available: 'p-available',
  description: 'p-description',
};

function setFieldValue(elId, value) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.value = value;
  el.classList.add('ai-filled');
  setTimeout(() => el.classList.remove('ai-filled'), 600);
}

function applyExtracted(extracted) {
  if (!extracted || typeof extracted !== 'object') return;

  for (const [key, elId] of Object.entries(FIELD_MAP)) {
    if (extracted[key] === undefined || extracted[key] === null || extracted[key] === '') continue;
    setFieldValue(elId, String(extracted[key]));
  }

  if (Array.isArray(extracted.tags) && extracted.tags.length) {
    setFieldValue('p-tags', extracted.tags.join(', '));
  }
  if (Array.isArray(extracted.amenities) && extracted.amenities.length) {
    setFieldValue('p-amenities', extracted.amenities.join('\n'));
  }
}

const aiForm = document.getElementById('ai-assist-form');
const aiInput = document.getElementById('ai-assist-input');
const aiSend = document.getElementById('ai-assist-send');
const aiLog = document.getElementById('ai-assist-log');

const aiHistory = [];

function appendMessage(role, text, opts = {}) {
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  if (opts.thinking) div.classList.add('thinking');
  div.textContent = text;
  if (opts.id) div.id = opts.id;
  aiLog.appendChild(div);
  aiLog.scrollTop = aiLog.scrollHeight;
  return div;
}

aiForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = aiInput.value.trim();
  if (!text) return;

  aiInput.value = '';
  aiSend.disabled = true;
  appendMessage('user', text);
  aiHistory.push({ role: 'user', content: text });

  const thinking = appendMessage('assistant', 'חושב…', { thinking: true });

  try {
    const res = await fetch(`${API_BASE}/api/landlord/extract-property`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ messages: aiHistory }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      thinking.classList.remove('thinking');
      thinking.textContent = errBody.error || 'משהו השתבש. ננסה שוב?';
      return;
    }

    const data = await res.json();
    applyExtracted(data.extracted);

    const reply = data.next_question
      || (data.ready ? 'מצוין, הטופס מוכן! אפשר ללחוץ "פרסם דירה".' : 'תוכלי להוסיף עוד פרטים?');
    thinking.classList.remove('thinking');
    thinking.textContent = reply;
    aiHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    thinking.classList.remove('thinking');
    thinking.textContent = 'אין חיבור לשרת כרגע. תוכלי למלא ידנית או לנסות שוב.';
  } finally {
    aiSend.disabled = false;
    aiInput.focus();
  }
});
