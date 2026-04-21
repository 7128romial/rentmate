/* ============================================================
   RentMate — Tinder-style Swipe Engine (vanilla JS)
   ============================================================ */

let allCards = [];
let filteredCards = [];
let currentIndex = 0;
let history = []; // for undo
let isDragging = false;
let startX = 0, startY = 0, currentX = 0;
let activeCard = null;

const stack = document.getElementById('card-stack');
const emptyState = document.getElementById('empty-state');
const minScoreSlider = document.getElementById('min-score');
const minScoreVal = document.getElementById('min-score-val');
const matchCounter = document.getElementById('match-counter');

// ---- Load cards from API ----
async function loadCards() {
  try {
    const res = await fetch('/api/matches?min_score=0');
    allCards = await res.json();
    applyFilter();
  } catch (e) {
    console.error('Failed to load matches:', e);
  }
}

function applyFilter() {
  const minScore = parseInt(minScoreSlider.value);
  filteredCards = allCards.filter(c => c.match_score >= minScore);
  currentIndex = 0;
  history = [];
  matchCounter.textContent = filteredCards.length + ' דירות';
  renderStack();
}

function reloadCards() {
  loadCards();
}

// ---- Render card stack (show up to 3) ----
function renderStack() {
  stack.innerHTML = '';

  if (currentIndex >= filteredCards.length) {
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  const count = Math.min(3, filteredCards.length - currentIndex);
  for (let i = count - 1; i >= 0; i--) {
    const card = createCardEl(filteredCards[currentIndex + i], i);
    stack.appendChild(card);
  }
}

function createCardEl(data, stackPos) {
  const card = document.createElement('div');
  card.className = 'swipe-card' + (stackPos === 0 ? ' front' : stackPos === 1 ? ' back-1' : ' back-2');
  card.dataset.id = data.id;

  const scoreClass = data.match_score >= 80 ? 'high' : data.match_score >= 60 ? 'medium' : 'low';

  const features = [];
  if (data.furnished) features.push('מרוהטת');
  if (data.parking) features.push('חנייה');
  if (data.elevator) features.push('מעלית');
  if (data.balcony) features.push('מרפסת');
  if (data.ac) features.push('מיזוג');
  if (data.pets_allowed) features.push('חיות מחמד');

  const bd = data.score_breakdown || {};
  const locPct = Math.round((bd.location || 0) / 30 * 100);
  const budPct = Math.round((bd.budget || 0) / 35 * 100);
  const lifPct = Math.round((bd.lifestyle || 0) / 25 * 100);
  const datPct = Math.round((bd.dates || 0) / 10 * 100);

  card.innerHTML = `
    <div class="stamp stamp-like">LIKE ❤️</div>
    <div class="stamp stamp-nope">NOPE ✕</div>
    <div class="swipe-card-img" ${data.primary_image ? `style="background-image:url('${data.primary_image}');background-size:cover;background-position:center;"` : ''}>
      ${!data.primary_image ? '🏠' : ''}
      <div class="swipe-card-gradient"></div>
      <span class="score-badge ${scoreClass}">${data.match_score}% Match</span>
      <button class="save-btn" onclick="event.stopPropagation();toggleFav(${data.id},this)">🤍</button>
      ${(data.images && data.images.length > 1) ? `
        <div class="swipe-card-photo-dots">
          ${data.images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}
        </div>` : ''}
    </div>
    <div class="swipe-card-body">
      <h3>${data.title}</h3>
      <div class="location">📍 ${data.city}${data.neighborhood ? ' · ' + data.neighborhood : ''}</div>
      <div class="price">₪${data.rent_price.toLocaleString()} / חודש</div>
      <div class="feature-tags">
        ${features.map(f => `<span class="pill pill-active">${f}</span>`).join('')}
      </div>
      <div class="score-bars">
        <div class="score-bar">
          <div class="score-bar-track"><div class="score-bar-fill loc" style="width:${locPct}%"></div></div>
          <span class="score-bar-label">מיקום</span>
        </div>
        <div class="score-bar">
          <div class="score-bar-track"><div class="score-bar-fill bud" style="width:${budPct}%"></div></div>
          <span class="score-bar-label">תקציב</span>
        </div>
        <div class="score-bar">
          <div class="score-bar-track"><div class="score-bar-fill lif" style="width:${lifPct}%"></div></div>
          <span class="score-bar-label">לייפסטייל</span>
        </div>
        <div class="score-bar">
          <div class="score-bar-track"><div class="score-bar-fill dat" style="width:${datPct}%"></div></div>
          <span class="score-bar-label">תאריכים</span>
        </div>
      </div>
    </div>
  `;

  // Only make front card draggable
  if (stackPos === 0) {
    card.addEventListener('mousedown', onDragStart);
    card.addEventListener('touchstart', onDragStart, { passive: false });
  }

  return card;
}

// ---- Drag handlers ----
function onDragStart(e) {
  if (e.target.closest('.save-btn')) return;
  isDragging = true;
  activeCard = e.currentTarget;
  const point = e.touches ? e.touches[0] : e;
  startX = point.clientX;
  startY = point.clientY;
  currentX = 0;
  activeCard.style.transition = 'none';
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
}

function onDragMove(e) {
  if (!isDragging || !activeCard) return;
  e.preventDefault();
  const point = e.touches ? e.touches[0] : e;
  currentX = point.clientX - startX;
  const rotation = currentX * 0.08;
  activeCard.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;

  // Stamps
  const likeStamp = activeCard.querySelector('.stamp-like');
  const nopeStamp = activeCard.querySelector('.stamp-nope');
  if (currentX > 30) {
    likeStamp.style.opacity = Math.min((currentX - 30) / 70, 1);
    nopeStamp.style.opacity = 0;
    activeCard.style.boxShadow = `0 0 30px rgba(34,197,94,${Math.min(currentX/200, 0.4)})`;
  } else if (currentX < -30) {
    nopeStamp.style.opacity = Math.min((-currentX - 30) / 70, 1);
    likeStamp.style.opacity = 0;
    activeCard.style.boxShadow = `0 0 30px rgba(239,68,68,${Math.min(-currentX/200, 0.4)})`;
  } else {
    likeStamp.style.opacity = 0;
    nopeStamp.style.opacity = 0;
    activeCard.style.boxShadow = '';
  }
}

function onDragEnd() {
  if (!isDragging || !activeCard) return;
  isDragging = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);

  if (currentX > 100) {
    animateOff('right');
  } else if (currentX < -100) {
    animateOff('left');
  } else {
    // Snap back
    activeCard.style.transition = 'transform 0.3s ease, box-shadow 0.3s';
    activeCard.style.transform = '';
    activeCard.style.boxShadow = '';
    activeCard.querySelector('.stamp-like').style.opacity = 0;
    activeCard.querySelector('.stamp-nope').style.opacity = 0;
  }
  activeCard = null;
}

function animateOff(direction) {
  const card = activeCard || stack.querySelector('.swipe-card.front');
  if (!card) return;

  const flyX = direction === 'right' ? window.innerWidth : -window.innerWidth;
  const rotation = direction === 'right' ? 30 : -30;

  card.style.transition = 'transform 0.5s ease, opacity 0.5s';
  card.style.transform = `translateX(${flyX}px) rotate(${rotation}deg)`;
  card.style.opacity = '0';

  if (direction === 'right') {
    // Save as favorite
    const id = card.dataset.id;
    if (id) {
      fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property_id: parseInt(id) })
      });
    }
  }

  history.push(currentIndex);
  currentIndex++;

  setTimeout(() => renderStack(), 400);
}

function swipeRight() {
  activeCard = stack.querySelector('.swipe-card.front');
  if (activeCard) {
    activeCard.querySelector('.stamp-like').style.opacity = 1;
    animateOff('right');
  }
}

function swipeLeft() {
  activeCard = stack.querySelector('.swipe-card.front');
  if (activeCard) {
    activeCard.querySelector('.stamp-nope').style.opacity = 1;
    animateOff('left');
  }
}

function undoSwipe() {
  if (history.length === 0) return;
  currentIndex = history.pop();
  renderStack();
}

// ---- Detail panel ----
function showDetail() {
  if (currentIndex >= filteredCards.length) return;
  const data = filteredCards[currentIndex];
  const bd = data.score_breakdown || {};
  const scoreClass = data.match_score >= 80 ? 'high' : data.match_score >= 60 ? 'medium' : 'low';

  const features = [
    { label: 'מרוהטת', val: data.furnished },
    { label: 'חנייה', val: data.parking },
    { label: 'מעלית', val: data.elevator },
    { label: 'מרפסת', val: data.balcony },
    { label: 'מיזוג', val: data.ac },
    { label: 'חיות מחמד', val: data.pets_allowed },
    { label: 'עישון', val: data.smoking_allowed },
  ];

  document.getElementById('detail-content').innerHTML = `
    <h2 style="margin-bottom:8px;">${data.title}</h2>
    <p class="text-muted" style="margin-bottom:20px;">📍 ${data.city} · ${data.neighborhood || ''}</p>

    <div class="score-circle ${scoreClass}">
      ${data.match_score}%
      <small>Match</small>
    </div>

    <table class="review-table" style="margin-bottom:20px;">
      <tr><td>📍 מיקום</td><td>${bd.location || 0}/30</td></tr>
      <tr><td>💰 תקציב</td><td>${bd.budget || 0}/35</td></tr>
      <tr><td>🌙 לייפסטייל</td><td>${bd.lifestyle || 0}/25</td></tr>
      <tr><td>📅 תאריכים</td><td>${bd.dates || 0}/10</td></tr>
    </table>

    <div class="price" style="font-size:1.5rem; margin-bottom:16px;">₪${data.rent_price.toLocaleString()} / חודש</div>

    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px;">
      ${data.rooms ? `<span class="pill">🛏 ${data.rooms} חדרים</span>` : ''}
      ${data.size_sqm ? `<span class="pill">📐 ${data.size_sqm} מ"ר</span>` : ''}
      ${data.floor !== null && data.floor !== undefined ? `<span class="pill">🏢 קומה ${data.floor}</span>` : ''}
    </div>

    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:24px;">
      ${features.map(f => `<span class="pill ${f.val ? 'pill-active' : 'pill-inactive'}">${f.val ? '✓' : '✗'} ${f.label}</span>`).join('')}
    </div>

    ${data.description ? `<p style="color:var(--text-light); line-height:1.8; margin-bottom:24px;">${data.description}</p>` : ''}

    <a href="/properties/${data.id}" class="btn btn-primary btn-block" style="margin-bottom:12px;">צפה בפרטים מלאים</a>
    <button class="btn btn-outline btn-block" onclick="startChat(${data.landlord_id}, ${data.id})">שלח הודעה למשכיר</button>
  `;

  document.getElementById('detail-overlay').classList.add('open');
  document.getElementById('detail-panel').classList.add('open');
}

function closeDetail() {
  document.getElementById('detail-overlay').classList.remove('open');
  document.getElementById('detail-panel').classList.remove('open');
}

async function startChat(landlordId, propertyId) {
  try {
    const res = await fetch(`/api/chat/start/${landlordId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: propertyId })
    });
    const data = await res.json();
    if (data.conversation_id) {
      window.location.href = `/chat?conv=${data.conversation_id}`;
    }
  } catch (e) {
    console.error('Failed to start chat:', e);
  }
}

async function toggleFav(id, btn) {
  try {
    const res = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_id: id })
    });
    const data = await res.json();
    btn.textContent = data.favorited ? '❤️' : '🤍';
  } catch (e) {
    console.error(e);
  }
}

// ---- Filter slider ----
minScoreSlider.addEventListener('input', () => {
  minScoreVal.textContent = minScoreSlider.value + '%';
  applyFilter();
});

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key) {
    case 'ArrowRight': swipeRight(); break;
    case 'ArrowLeft': swipeLeft(); break;
    case 'ArrowUp': e.preventDefault(); showDetail(); break;
    case 'z':
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); undoSwipe(); }
      break;
    case 'Escape': closeDetail(); break;
  }
});

// ---- Init ----
loadCards();
