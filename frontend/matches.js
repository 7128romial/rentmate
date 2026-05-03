import { renderBottomNav } from './src/nav.js';
import { getMatches, removeMatch } from './src/storage.js';

renderBottomNav('matches');

const list = document.getElementById('match-list');
const subtitle = document.getElementById('matches-subtitle');
const filterBar = document.getElementById('filter-bar');
const searchInput = document.getElementById('filter-search');
const clearBtn = document.getElementById('filter-clear');
const sortSelect = document.getElementById('filter-sort');
const chipsHost = document.getElementById('filter-chips');

const state = {
  q: '',
  sort: 'newest',
  tags: new Set(),
};

function priceValue(property) {
  if (!property || !property.price) return Number.POSITIVE_INFINITY;
  const digits = String(property.price).replace(/[^\d]/g, '');
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function timestamp(property) {
  if (!property || !property.matchedAt) return 0;
  const t = new Date(property.matchedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return 'עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק'`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.round(hours / 24);
  return `לפני ${days} ימים`;
}

function getAllTags(matches) {
  const set = new Set();
  matches.forEach((m) => (m.tags || []).forEach((t) => t && set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'he'));
}

function applyFilters(matches) {
  const q = state.q.trim().toLowerCase();
  let result = matches.filter((m) => {
    if (q) {
      const hay = `${m.title || ''} ${m.address || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.tags.size) {
      const tags = new Set(m.tags || []);
      for (const t of state.tags) {
        if (!tags.has(t)) return false;
      }
    }
    return true;
  });

  switch (state.sort) {
    case 'price-asc':
      result.sort((a, b) => priceValue(a) - priceValue(b));
      break;
    case 'price-desc':
      result.sort((a, b) => priceValue(b) - priceValue(a));
      break;
    case 'match':
      result.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
      break;
    case 'newest':
    default:
      result.sort((a, b) => timestamp(b) - timestamp(a));
      break;
  }
  return result;
}

function renderEmptyOverall() {
  list.innerHTML = '';
  filterBar.hidden = true;
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const title = document.createElement('h3');
  title.textContent = 'עדיין אין התאמות';
  const desc = document.createElement('p');
  desc.textContent = 'תתחילו להחליק על דירות — כל סווייפ ימינה שמתקבל יופיע כאן.';
  const cta = document.createElement('a');
  cta.href = '/swipe.html';
  cta.textContent = 'גלו דירות';
  empty.appendChild(title);
  empty.appendChild(desc);
  empty.appendChild(cta);
  list.appendChild(empty);
  subtitle.textContent = 'אין כאן עדיין כלום — בואו נמצא לכם דירה.';
}

function renderEmptyFiltered() {
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const title = document.createElement('h3');
  title.textContent = 'אין תוצאות שמתאימות לסינון';
  const desc = document.createElement('p');
  desc.textContent = 'נסו לנקות את החיפוש או להסיר תגיות.';
  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'btn-clear-filters';
  cta.textContent = 'נקה סינון';
  cta.addEventListener('click', resetFilters);
  empty.appendChild(title);
  empty.appendChild(desc);
  empty.appendChild(cta);
  list.appendChild(empty);
}

function renderChips(allTags) {
  chipsHost.innerHTML = '';
  allTags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-chip' + (state.tags.has(tag) ? ' active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      if (state.tags.has(tag)) state.tags.delete(tag);
      else state.tags.add(tag);
      render();
    });
    chipsHost.appendChild(btn);
  });
}

function renderRows(matches) {
  list.innerHTML = '';
  matches.forEach((property) => {
    const card = document.createElement('a');
    card.className = 'match-card';
    card.href = `/realtime_chat.html?id=${encodeURIComponent(property.id)}`;
    card.dataset.id = property.id;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (property.image) {
      thumb.style.backgroundImage = `url(${JSON.stringify(String(property.image))})`;
    }

    const body = document.createElement('div');
    body.className = 'body';
    const h3 = document.createElement('h3');
    h3.textContent = property.title || 'דירה';
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = property.price || '';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const when = formatRelative(property.matchedAt);
    meta.textContent = property.address
      ? `📍 ${property.address}${when ? ` · ${when}` : ''}`
      : when;

    body.appendChild(h3);
    body.appendChild(price);
    body.appendChild(meta);

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'הסר התאמה';
    remove.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removeMatch(property.id);
      render();
    });

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(remove);
    list.appendChild(card);
  });
}

function resetFilters() {
  state.q = '';
  state.tags.clear();
  state.sort = 'newest';
  searchInput.value = '';
  sortSelect.value = 'newest';
  clearBtn.hidden = true;
  render();
}

function render() {
  const matches = getMatches();
  if (matches.length === 0) {
    renderEmptyOverall();
    return;
  }
  filterBar.hidden = false;
  renderChips(getAllTags(matches));

  const filtered = applyFilters(matches);
  if (filtered.length === 0) {
    subtitle.textContent = `0 מתוך ${matches.length} התאמות`;
    renderEmptyFiltered();
    return;
  }
  subtitle.textContent =
    filtered.length === matches.length
      ? `${matches.length} ${matches.length === 1 ? 'התאמה פעילה' : 'התאמות פעילות'}`
      : `${filtered.length} מתוך ${matches.length} התאמות`;
  renderRows(filtered);
}

searchInput.addEventListener('input', () => {
  state.q = searchInput.value;
  clearBtn.hidden = state.q.length === 0;
  render();
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  state.q = '';
  clearBtn.hidden = true;
  searchInput.focus();
  render();
});

sortSelect.addEventListener('change', () => {
  state.sort = sortSelect.value;
  render();
});

render();
