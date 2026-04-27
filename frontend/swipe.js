import { API_BASE, DEMO_MODE, authHeaders, getUserId } from './src/config.js';
import { DEMO_PROPERTIES } from './src/demo.js';
import { renderBottomNav } from './src/nav.js';
import { addMatch } from './src/storage.js';

renderBottomNav('swipe');

const propertyById = new Map();

const swipeContainer = document.getElementById('swipe-container');
const currentCards = [];

function createCard(property) {
  const card = document.createElement('div');
  card.classList.add('swipe-card');
  card.dataset.id = property.id;
  card.style.backgroundImage = `url(${JSON.stringify(String(property.image || ''))})`;

  const gradient = document.createElement('div');
  gradient.classList.add('card-gradient');

  const info = document.createElement('div');
  info.classList.add('card-info');

  const matchBadge = document.createElement('div');
  matchBadge.classList.add('match-badge');
  matchBadge.textContent = `התאמה של ${property.matchScore}%`;

  const title = document.createElement('h3');
  title.textContent = property.title;

  const price = document.createElement('p');
  price.classList.add('card-price');
  price.textContent = property.price;

  const tagsContainer = document.createElement('div');
  tagsContainer.classList.add('card-tags');
  (property.tags || []).forEach((tag) => {
    const span = document.createElement('span');
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });

  info.appendChild(matchBadge);
  info.appendChild(title);
  info.appendChild(price);
  info.appendChild(tagsContainer);

  card.appendChild(gradient);
  card.appendChild(info);

  return card;
}

function showInterestToast() {
  const existing = document.querySelector('.interest-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'interest-toast';
  toast.textContent = 'הבקשה נשלחה לבעל/ת הנכס';
  toast.style.cssText = 'position:fixed;bottom:110px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 18px;border-radius:20px;font-size:14px;z-index:100;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1800);
}

async function recordSwipe(property_id, direction) {
  if (DEMO_MODE) {
    // For the demo, every 3rd right-swipe "matches"; the rest just send interest.
    const isMatch = direction !== 'left' && Math.random() < 0.33;
    return { isMatch, interestSent: direction !== 'left' };
  }
  if (!getUserId()) return { isMatch: false, interestSent: direction === 'right' || direction === 'up' };
  try {
    const res = await fetch(`${API_BASE}/api/swipe`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ property_id, direction }),
    });
    if (res.status === 401) {
      window.location.href = '/';
      return { isMatch: false, interestSent: false };
    }
    if (!res.ok) return { isMatch: false, interestSent: false };
    return await res.json();
  } catch (err) {
    console.error('API Error', err);
    return { isMatch: false, interestSent: direction === 'right' || direction === 'up' };
  }
}

async function loadProperties() {
  if (DEMO_MODE) return DEMO_PROPERTIES;
  try {
    const res = await fetch(`${API_BASE}/api/properties`, { headers: authHeaders() });
    if (res.status === 401) {
      window.location.href = '/';
      return [];
    }
    return await res.json();
  } catch (err) {
    console.error('API Error', err);
    return DEMO_PROPERTIES;
  }
}

async function initCards() {
  if (!DEMO_MODE && !getUserId()) {
    window.location.href = '/';
    return;
  }
  const properties = await loadProperties();

  properties.reverse().forEach((prop) => {
    propertyById.set(String(prop.id), prop);
    const card = createCard(prop);
    swipeContainer.appendChild(card);
    currentCards.push(card);

    const hammer = new Hammer(card);

    hammer.on('pan', (ev) => {
      if (ev.deltaX === 0) return;
      if (ev.center.x === 0 && ev.center.y === 0) return;
      const rotate = ev.deltaX * 0.05;
      card.style.transform = `translate(${ev.deltaX}px, ${ev.deltaY}px) rotate(${rotate}deg)`;
    });

    hammer.on('panend', (ev) => {
      const keep = Math.abs(ev.deltaX) < 80;
      card.classList.toggle('removed', !keep);

      if (keep) {
        card.style.transform = '';
      } else {
        const endX = Math.max(Math.abs(ev.velocity * 800), 300);
        const toX = ev.deltaX > 0 ? endX : -endX;
        const endY = Math.abs(ev.velocity * 800) || 300;
        const toY = ev.deltaY > 0 ? endY : -endY;
        const rotate = ev.deltaX * 0.03;
        card.style.transform = `translate(${toX}px, ${toY + ev.deltaY}px) rotate(${rotate}deg)`;
        setTimeout(() => card.remove(), 300);

        const direction = ev.deltaX > 0 ? 'right' : 'left';
        handleSwipeCompletion(prop.id, direction);
      }
    });
  });
}

function handleSwipeCompletion(property_id, direction) {
  const isLastCard = swipeContainer.children.length === 1;
  recordSwipe(property_id, direction).then((result) => {
    if (result.isMatch) {
      const prop = propertyById.get(String(property_id));
      if (prop) addMatch(prop);
      setTimeout(() => {
        const url = prop
          ? `/match.html?id=${encodeURIComponent(prop.id)}`
          : '/match.html';
        window.location.href = url;
      }, 500);
      return;
    }
    if (result.interestSent) showInterestToast();
    if (isLastCard) {
      setTimeout(() => {
        alert('נגמרו הדירות שמתאימות לחיפוש שלך! נחפש מחדש...');
        window.location.reload();
      }, 500);
    }
  });
}

document.getElementById('btn-nope').addEventListener('click', () => swipeAction('left'));
document.getElementById('btn-like').addEventListener('click', () => swipeAction('right'));
document.getElementById('btn-super').addEventListener('click', () => swipeAction('up'));

function swipeAction(direction) {
  const cards = document.querySelectorAll('.swipe-card:not(.removed)');
  if (!cards.length) return;
  const topCard = cards[cards.length - 1];
  topCard.classList.add('removed');

  let toX = 0;
  let toY = 0;
  if (direction === 'left') toX = -1000;
  if (direction === 'right') toX = 1000;
  if (direction === 'up') toY = -1000;

  topCard.style.transform = `translate(${toX}px, ${toY}px) rotate(${toX * 0.03}deg)`;
  setTimeout(() => topCard.remove(), 300);

  const propId = topCard.dataset.id;
  handleSwipeCompletion(propId, direction);
}

initCards();
