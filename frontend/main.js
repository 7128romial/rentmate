import { FLOW } from './src/onboarding-flow.js';
import { API_BASE, authHeaders, getToken } from './src/config.js';
import {
  addUserProperty,
  setProfile,
  setRole,
  setSubrole,
  setUserListing,
} from './src/storage.js';

async function syncToBackend(role, profile) {
  if (!getToken()) return;
  try {
    await fetch(`${API_BASE}/api/profile`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        role,
        name: profile.name || '',
        city: profile.city || '',
        budget: Number(profile.budget) || 0,
        type: profile.type || '',
        extras: profile.extras || '',
      }),
    });
  } catch (err) {
    console.error('Profile sync failed', err);
  }
}

const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const ctx = {
  role: null,
  subrole: null,
  profile: {},
  listing: {},
};

let currentStepId = '_start';

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  // Preserve newlines in scripted AI text without using innerHTML.
  text.split('\n').forEach((line, i) => {
    if (i > 0) contentDiv.appendChild(document.createElement('br'));
    contentDiv.appendChild(document.createTextNode(line));
  });
  msgDiv.appendChild(contentDiv);
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai typing-message';
  wrapper.id = 'typing-indicator';
  const content = document.createElement('div');
  content.className = 'message-content typing-indicator';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'typing-dot';
    content.appendChild(d);
  }
  wrapper.appendChild(content);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

function clearQuickReplies() {
  document.querySelectorAll('.quick-reply-row, .slider-widget').forEach((el) => el.remove());
}

function renderSlider(step, onConfirm) {
  const wrap = document.createElement('div');
  wrap.className = 'slider-widget';

  const value = document.createElement('div');
  value.className = 'slider-value';

  const range = document.createElement('input');
  range.type = 'range';
  range.min = String(step.min);
  range.max = String(step.max);
  range.step = String(step.step || 1);
  range.value = String(step.default != null ? step.default : step.min);
  range.className = 'slider-range';

  const labels = document.createElement('div');
  labels.className = 'slider-track-labels';
  const minLbl = document.createElement('span');
  const maxLbl = document.createElement('span');
  const fmt = step.format || ((v) => String(v));
  minLbl.textContent = fmt(step.min);
  maxLbl.textContent = fmt(step.max);
  labels.appendChild(minLbl);
  labels.appendChild(maxLbl);

  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'btn-primary slider-confirm';
  confirm.textContent = 'אישור';

  function updateUI() {
    const v = Number(range.value);
    value.textContent = fmt(v);
    const pct = ((v - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
    range.style.setProperty('--pct', `${pct}%`);
  }
  updateUI();
  range.addEventListener('input', updateUI);

  confirm.addEventListener('click', () => {
    const v = Number(range.value);
    onConfirm({ value: v, label: fmt(v) });
  });

  wrap.appendChild(value);
  wrap.appendChild(range);
  wrap.appendChild(labels);
  wrap.appendChild(confirm);
  messagesContainer.appendChild(wrap);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderQuickReplies(options, onPick, allowCustom) {
  if (!options || !options.length) {
    if (!allowCustom) return;
  }
  const row = document.createElement('div');
  row.className = 'quick-reply-row';
  (options || []).forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-reply';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => onPick(opt));
    row.appendChild(btn);
  });
  if (allowCustom) {
    const other = document.createElement('button');
    other.type = 'button';
    other.className = 'quick-reply quick-reply-other';
    other.textContent = '+ אחר';
    other.addEventListener('click', () => {
      clearQuickReplies();
      chatInput.placeholder = 'הקלידי את התשובה שלך…';
      chatInput.focus();
    });
    row.appendChild(other);
  }
  messagesContainer.appendChild(row);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function applySave(savePath, value) {
  if (!savePath || !Array.isArray(savePath)) return;
  const [bucket, key] = savePath;
  if (!ctx[bucket] || typeof ctx[bucket] !== 'object') ctx[bucket] = {};
  ctx[bucket][key] = value;
}

function applySet(set) {
  if (!set || typeof set !== 'object') return;
  Object.keys(set).forEach((k) => {
    ctx[k] = set[k];
  });
}

function finalize(redirect) {
  if (ctx.role) setRole(ctx.role);
  if (ctx.subrole) setSubrole(ctx.subrole);
  if (ctx.profile && Object.keys(ctx.profile).length) setProfile(ctx.profile);

  if (ctx.role === 'roommate' && ctx.subrole === 'host' && ctx.listing) {
    const price = Number(ctx.listing.roomPrice) || 2400;
    setUserListing({
      id: 'my-listing',
      title: `חדר בדירה ב${ctx.listing.address || 'תל אביב'}`,
      price: `₪${price.toLocaleString('he-IL')}/חודש`,
      address: ctx.listing.address || 'תל אביב',
      location: ctx.listing.address || 'תל אביב',
      image:
        'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
      matchScore: 95,
      tags: ['דירה משותפת'],
      kind: 'shared',
      description: ctx.listing.aboutMe || '',
      host: {
        name: ctx.profile.name || 'אני',
        lifestyle: ctx.listing.aboutMe || '',
      },
    });
  }

  if (ctx.role === 'landlord' && ctx.firstProperty && ctx.firstProperty.title) {
    const fp = ctx.firstProperty;
    const price = Number(fp.price) || 4500;
    addUserProperty({
      title: fp.title,
      price: `₪${price.toLocaleString('he-IL')}/חודש`,
      address: fp.address || '',
      location: fp.address || '',
      image:
        fp.image && fp.image !== 'דלג'
          ? fp.image
          : 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80',
      matchScore: 95,
      tags: [],
      rooms: fp.rooms || null,
      area: null,
      floor: null,
      totalFloors: null,
      available: '',
      description: '',
      amenities: [],
      nearby: [],
      kind: 'apartment',
    });
  }

  syncToBackend(ctx.role, ctx.profile || {});

  setTimeout(() => {
    window.location.href = redirect || '/swipe.html';
  }, 1600);
}

function advance(stepId) {
  currentStepId = stepId;
  const step = FLOW[stepId];
  if (!step) return;

  showTyping();
  setTimeout(() => {
    removeTyping();
    appendMessage(step.ai, 'ai');

    if (step.final) {
      finalize(step.final.redirect);
      return;
    }

    if (step.inputType === 'slider') {
      renderSlider(step, ({ value, label }) => handleAnswer(step, label, value, {}));
      return;
    }

    // Show chips (and "+ אחר") only when there are preset options to choose from.
    // For purely-open questions, the bottom text input is the input — don't add UI noise.
    if (step.options && step.options.length) {
      const allowCustom = step.freeText !== false;
      renderQuickReplies(step.options, (opt) => handlePick(step, opt), allowCustom);
    }
  }, 700);
}

function handleAnswer(step, label, payload, set) {
  // 1. echo as user message
  clearQuickReplies();
  appendMessage(label, 'user');
  // 2. apply set + save
  applySet(set);
  applySave(step.save, payload);
  // 3. advance
  const nextId = (set && set.next) || step.next;
  if (nextId) advance(nextId);
}

function handlePick(step, opt) {
  const value = opt.value !== undefined ? opt.value : opt.label;
  handleAnswer(step, opt.label, value, { ...(opt.set || {}), next: opt.next });
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  const step = FLOW[currentStepId];
  if (!step) return;
  if (step.freeText === false) {
    // Free-text not allowed at this step (e.g., role selection).
    return;
  }
  chatInput.value = '';
  handleAnswer(step, text, text, {});
});

advance('_start');
