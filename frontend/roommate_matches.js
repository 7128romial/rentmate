import { renderBottomNav } from './src/nav.js';
import { getRole, getRoommateMatches, getSubrole, removeRoommateMatch } from './src/storage.js';

if (getRole() !== 'roommate' || getSubrole() !== 'seeker') {
  window.location.replace('/roommate_choice.html');
}

renderBottomNav('roommate-matches');

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
  title.textContent = 'עדיין אין שותפים';
  const desc = document.createElement('p');
  desc.textContent = 'תתחילו להחליק ימינה — כל מאץ' + "'" + ' יופיע כאן.';
  const cta = document.createElement('a');
  cta.href = '/roommate_seeker.html';
  cta.textContent = 'מצא שותף';
  empty.appendChild(title);
  empty.appendChild(desc);
  empty.appendChild(cta);
  list.appendChild(empty);
  subtitle.textContent = 'רק התחלנו — בואו נמצא לכם שותף.';
}

function render() {
  const matches = getRoommateMatches();
  if (!matches.length) {
    renderEmpty();
    return;
  }
  subtitle.textContent = `${matches.length} ${matches.length === 1 ? 'שותף פוטנציאלי' : 'שותפים פוטנציאליים'}`;
  list.innerHTML = '';

  matches.forEach((person) => {
    const card = document.createElement('a');
    card.className = 'match-card';
    card.href = `/realtime_chat.html?person=${encodeURIComponent(person.id)}`;
    card.dataset.id = person.id;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (person.photo) {
      thumb.style.backgroundImage = `url(${JSON.stringify(String(person.photo))})`;
    }

    const body = document.createElement('div');
    body.className = 'body';
    const h3 = document.createElement('h3');
    h3.textContent = `${person.name}, ${person.age}`;
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = person.budget ? `תקציב ₪${person.budget.toLocaleString('he-IL')}` : '';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const when = formatRelative(person.matchedAt);
    const parts = [];
    if (person.targetArea) parts.push(`📍 ${person.targetArea}`);
    if (when) parts.push(when);
    meta.textContent = parts.join(' · ');

    body.appendChild(h3);
    if (person.budget) body.appendChild(price);
    body.appendChild(meta);

    const remove = document.createElement('button');
    remove.className = 'remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.title = 'הסר';
    remove.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removeRoommateMatch(person.id);
      render();
    });

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(remove);
    list.appendChild(card);
  });
}

render();
