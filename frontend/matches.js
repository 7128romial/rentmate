import { renderBottomNav } from './src/nav.js';
import { getMatches, removeMatch } from './src/storage.js';

renderBottomNav('matches');

const list = document.getElementById('match-list');
const subtitle = document.getElementById('matches-subtitle');

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

function renderEmpty() {
  list.innerHTML = '';
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

function renderMatches(matches) {
  list.innerHTML = '';
  subtitle.textContent = `${matches.length} ${matches.length === 1 ? 'התאמה פעילה' : 'התאמות פעילות'}`;

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
      const updated = removeMatch(property.id);
      if (updated.length === 0) renderEmpty();
      else renderMatches(updated);
    });

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(remove);
    list.appendChild(card);
  });
}

const matches = getMatches();
if (matches.length === 0) renderEmpty();
else renderMatches(matches);
