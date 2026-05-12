import { renderBottomNav } from './src/nav.js';
import { addUserProperty, getRole, updateUserProperty } from './src/storage.js';
import { API_BASE, authHeaders, getToken } from './src/config.js';

if (getRole() !== 'landlord') {
  window.location.replace('/swipe.html');
}

renderBottomNav('landlord');

const editId = new URLSearchParams(window.location.search).get('id');
const isEdit = !!editId;

if (isEdit) {
  document.getElementById('form-title').textContent = 'ערוך דירה';
  const submitBtn = document.querySelector('#property-form button[type="submit"]');
  if (submitBtn) submitBtn.textContent = 'שמור שינויים';
}

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

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const priceMin = getInt('p-price-min', 0);
  const priceMax = getInt('p-price-max', 0);
  const lo = Math.min(priceMin, priceMax);
  const hi = Math.max(priceMin, priceMax);

  const priceLabel = lo === hi
    ? `₪${lo.toLocaleString('he-IL')}/חודש`
    : `₪${lo.toLocaleString('he-IL')}–${hi.toLocaleString('he-IL')}/חודש`;

  const fileInput = document.getElementById('p-image');
  let imageUrl = fileInput.dataset.uploadedUrl || 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80';

  if (!fileInput.dataset.uploadedUrl && fileInput.files && fileInput.files[0]) {
    // Fallback if not uploaded yet during 'change' event
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        imageUrl = data.url || imageUrl;
      }
    } catch(e) {
      console.error("Upload failed", e);
      alert('Upload failed');
      return;
    }
  }

  const property = {
    title: get('p-title'),
    priceMin: lo,
    priceMax: hi,
    price: priceLabel,
    location: get('p-address'),
    address: get('p-address'),
    image: imageUrl,
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

  if (isEdit) {
    await updateUserProperty(editId, property);
    window.location.href = `/landlord_property.html?id=${encodeURIComponent(editId)}`;
  } else {
    await addUserProperty(property);
    window.location.href = '/landlord.html';
  }
});

const fileInputEl = document.getElementById('p-image');
fileInputEl.addEventListener('change', async (e) => {
  if (!e.target.files || !e.target.files[0]) return;

  // Show some loading indication on the description field
  const descEl = document.getElementById('p-description');
  const tagsEl = document.getElementById('p-tags');
  const originalDesc = descEl.value;
  descEl.value = 'ה-AI שלנו מנתח את התמונה... 🤖';

  const formData = new FormData();
  formData.append('file', e.target.files[0]);

  try {
    const uploadRes = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}` },
      body: formData
    });
    
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      fileInputEl.dataset.uploadedUrl = uploadData.url;

      // Call Vision API
      const visionRes = await fetch(`${API_BASE}/api/analyze-property-image`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: uploadData.url })
      });

      if (visionRes.ok) {
        const visionData = await visionRes.json();
        if (visionData.description) descEl.value = visionData.description;
        else descEl.value = originalDesc;
        
        if (visionData.tags && Array.isArray(visionData.tags)) {
          tagsEl.value = visionData.tags.join(', ');
        }
      } else {
        descEl.value = originalDesc;
      }
    } else {
      descEl.value = originalDesc;
    }
  } catch (err) {
    console.error(err);
    descEl.value = originalDesc;
  }
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

// Prefill from existing property in edit mode, otherwise from onboarding profile
window.addEventListener('DOMContentLoaded', async () => {
  if (isEdit) {
    try {
      const res = await fetch(`${API_BASE}/api/landlord/properties/${encodeURIComponent(editId)}`, { headers: authHeaders() });
      if (res.status === 404) {
        alert('הדירה לא נמצאה. חוזרים לדשבורד.');
        window.location.href = '/landlord.html';
        return;
      }
      if (!res.ok) {
        console.error('Failed to load property for edit', res.status);
        return;
      }
      const prop = await res.json();
      const set = (id, v) => { if (v !== undefined && v !== null && v !== '') setFieldValue(id, String(v)); };
      set('p-title', prop.title);
      set('p-price-min', prop.priceMin ?? prop.price_min);
      set('p-price-max', prop.priceMax ?? prop.price_max);
      set('p-address', prop.address || prop.location);
      set('p-rooms', prop.rooms);
      set('p-area', prop.area);
      set('p-floor', prop.floor);
      set('p-total-floors', prop.totalFloors ?? prop.total_floors);
      set('p-available', prop.available);
      set('p-description', prop.description);
      if (Array.isArray(prop.tags)) set('p-tags', prop.tags.join(', '));
      else if (typeof prop.tags === 'string') set('p-tags', prop.tags);
      if (Array.isArray(prop.amenities)) set('p-amenities', prop.amenities.join('\n'));
      if (prop.image) {
        document.getElementById('p-image').dataset.uploadedUrl = prop.image;
      }
    } catch (e) {
      console.error('Failed to fetch property for edit', e);
    }
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/profile`, {
      headers: authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      if (data.profile) {
        if (data.profile.city && !document.getElementById('p-address').value) {
          setFieldValue('p-address', data.profile.city);
        }
        if (data.profile.budget && !document.getElementById('p-price-max').value) {
          setFieldValue('p-price-max', String(data.profile.budget));
          setFieldValue('p-price-min', String(Math.max(0, data.profile.budget - 500)));
        }
        if (data.profile.extras && !document.getElementById('p-amenities').value) {
          setFieldValue('p-amenities', data.profile.extras.split(',').join('\n'));
        }

        // Try to parse rooms from type if possible
        if (data.profile.type) {
          const roomsMatch = data.profile.type.match(/(\d+(\.\d+)?)/);
          if (roomsMatch && !document.getElementById('p-rooms').value) {
            setFieldValue('p-rooms', roomsMatch[1]);
          }
        }
      }
    }
  } catch (e) {
    console.error("Failed to fetch profile for auto-fill", e);
  }
});
