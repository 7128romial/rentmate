import { renderBottomNav } from './src/nav.js';
import { DEMO_ROOMMATE_PEOPLE } from './src/demo.js';
import { addRoommateMatch, getRole, getSubrole } from './src/storage.js';
import { mountSwipeDeck, programmaticSwipe } from './src/swipe-deck.js';

if (getRole() !== 'roommate' || getSubrole() !== 'seeker') {
  window.location.replace('/roommate_choice.html');
}

renderBottomNav('roommate-seeker');

const swipeContainer = document.getElementById('swipe-container');

function createPersonCard(person) {
  const card = document.createElement('div');
  card.classList.add('swipe-card');
  card.dataset.id = person.id;

  const hero = document.createElement('div');
  hero.classList.add('card-hero');
  hero.style.backgroundImage = `url(${JSON.stringify(String(person.photo || ''))})`;

  const gradient = document.createElement('div');
  gradient.classList.add('card-gradient');

  const info = document.createElement('div');
  info.classList.add('card-info');

  const matchBadge = document.createElement('div');
  matchBadge.classList.add('match-badge');
  matchBadge.textContent = `התאמה של ${person.matchScore}%`;

  const title = document.createElement('h3');
  title.textContent = `${person.name}, ${person.age}`;

  const occ = document.createElement('p');
  occ.classList.add('card-price');
  occ.textContent = person.occupation || '';

  const meta = document.createElement('p');
  meta.classList.add('card-address');
  const parts = [];
  if (person.budget) parts.push(`תקציב ₪${person.budget.toLocaleString('he-IL')}`);
  if (person.targetArea) parts.push(person.targetArea);
  meta.textContent = parts.join(' · ');

  const tagsContainer = document.createElement('div');
  tagsContainer.classList.add('card-tags');
  (person.tags || []).forEach((tag) => {
    const span = document.createElement('span');
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });

  info.appendChild(matchBadge);
  info.appendChild(title);
  info.appendChild(occ);
  if (parts.length) info.appendChild(meta);
  info.appendChild(tagsContainer);

  const hint = document.createElement('div');
  hint.className = 'scroll-hint';
  hint.textContent = 'גלילה למטה לפרטים נוספים ↓';

  hero.appendChild(gradient);
  hero.appendChild(info);
  hero.appendChild(hint);
  card.appendChild(hero);

  // --- Details ---
  const details = document.createElement('div');
  details.classList.add('card-details');

  if (person.bio) {
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = 'על עצמי';
    const p = document.createElement('p');
    p.textContent = person.bio;
    sec.appendChild(h);
    sec.appendChild(p);
    details.appendChild(sec);
  }

  const facts = [
    ['גיל', person.age],
    ['עיסוק', person.occupation],
    ['תקציב', person.budget ? `₪${person.budget.toLocaleString('he-IL')}` : null],
    ['אזור מבוקש', person.targetArea],
    ['מועד מעבר', person.moveIn],
  ].filter(([, v]) => v != null && v !== '');
  if (facts.length) {
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = 'פרטים';
    const grid = document.createElement('div');
    grid.className = 'fact-grid';
    facts.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'fact';
      const label = document.createElement('span');
      label.className = 'fact-label';
      label.textContent = k;
      const value = document.createElement('span');
      value.className = 'fact-value';
      value.textContent = String(v);
      row.appendChild(label);
      row.appendChild(value);
      grid.appendChild(row);
    });
    sec.appendChild(h);
    sec.appendChild(grid);
    details.appendChild(sec);
  }

  if (person.lifestyle) {
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = 'אורח חיים';
    const p = document.createElement('p');
    p.textContent = person.lifestyle;
    sec.appendChild(h);
    sec.appendChild(p);
    details.appendChild(sec);
  }

  card.appendChild(details);
  return card;
}

function showInterestToast(text) {
  const existing = document.querySelector('.interest-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'interest-toast';
  toast.textContent = text;
  toast.style.cssText =
    'position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 18px;border-radius:20px;font-size:14px;z-index:100;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

function handleSwipe(person, direction) {
  if (direction === 'left') return;
  const isMatch = Math.random() < 0.4;
  if (isMatch) {
    addRoommateMatch(person);
    setTimeout(() => {
      window.location.href = `/match.html?person=${encodeURIComponent(person.id)}`;
    }, 400);
  } else {
    showInterestToast('הבקשה נשלחה');
  }
}

mountSwipeDeck({
  container: swipeContainer,
  items: DEMO_ROOMMATE_PEOPLE,
  renderCard: createPersonCard,
  onSwipe: handleSwipe,
  onEmpty: () => {
    alert('עברנו על כל המועמדים. נמצא עוד...');
    window.location.reload();
  },
});

const onClickSwipe = (direction) =>
  programmaticSwipe(
    swipeContainer,
    direction,
    handleSwipe,
    () => {
      alert('עברנו על כל המועמדים. נמצא עוד...');
      window.location.reload();
    },
    DEMO_ROOMMATE_PEOPLE,
  );
document.getElementById('btn-nope').addEventListener('click', () => onClickSwipe('left'));
document.getElementById('btn-like').addEventListener('click', () => onClickSwipe('right'));
document.getElementById('btn-super').addEventListener('click', () => onClickSwipe('up'));
