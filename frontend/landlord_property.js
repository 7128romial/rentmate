import { renderBottomNav } from './src/nav.js';
import {
  DEMO_RENTERS,
  findDemoProperty,
  findDemoRenter,
  getInterestedRenterIds,
} from './src/demo.js';
import {
  approveRenter,
  getRenterDecision,
  getRole,
  getUserProperties,
  getUserPropertyInterests,
  rejectRenter,
  undoRenterDecision,
} from './src/storage.js';

if (getRole() !== 'landlord') {
  window.location.replace('/swipe.html');
}

renderBottomNav('landlord');

const params = new URLSearchParams(window.location.search);
const propertyId = params.get('id');
const property =
  findDemoProperty(propertyId) ||
  getUserProperties().find((p) => String(p.id) === String(propertyId));

if (!property) {
  window.location.replace('/landlord.html');
}

document.getElementById('property-title').textContent = property.title;
document.getElementById('property-subtitle').textContent = property.address
  ? `📍 ${property.address} · ${property.price}`
  : property.price;

const list = document.getElementById('renter-list');
const tabButtons = document.querySelectorAll('.tab');

let activeTab = 'pending';

function decisionsByGroup() {
  const ids = [
    ...getInterestedRenterIds(property.id),
    ...getUserPropertyInterests(property.id),
  ];
  const grouped = { pending: [], approved: [], rejected: [] };
  ids.forEach((rid) => {
    const renter = findDemoRenter(rid);
    if (!renter) return;
    const decision = getRenterDecision(property.id, rid);
    grouped[decision].push(renter);
  });
  return grouped;
}

function renderCounts(grouped) {
  document.getElementById('count-pending').textContent = grouped.pending.length;
  document.getElementById('count-approved').textContent = grouped.approved.length;
}

function renderEmpty(message) {
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const title = document.createElement('h3');
  title.textContent = message;
  const desc = document.createElement('p');
  desc.textContent = activeTab === 'pending'
    ? 'כשמישהו יחליק ימינה על הדירה תקבל/י כאן הצצה לפרופיל שלו.'
    : 'אישרו פרופיל מהלשונית "מתעניינים" כדי להתחיל שיחה.';
  empty.appendChild(title);
  empty.appendChild(desc);
  list.appendChild(empty);
}

function actionsFor(renter, decision) {
  const wrap = document.createElement('div');
  wrap.className = 'renter-actions';

  if (decision === 'pending') {
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'icon-btn reject';
    reject.title = 'דחה';
    reject.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    reject.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      rejectRenter(property.id, renter.id);
      render();
    });

    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'icon-btn approve';
    approve.title = 'אשר';
    approve.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    approve.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      approveRenter(property.id, renter.id);
      render();
    });

    wrap.appendChild(reject);
    wrap.appendChild(approve);
    return wrap;
  }

  if (decision === 'approved') {
    const chat = document.createElement('a');
    chat.className = 'btn-primary chat-btn';
    chat.href = `/realtime_chat.html?id=${encodeURIComponent(property.id)}&renter=${encodeURIComponent(renter.id)}`;
    chat.textContent = 'שלח הודעה';

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'btn-ghost';
    undo.textContent = 'בטל אישור';
    undo.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      undoRenterDecision(property.id, renter.id);
      render();
    });

    wrap.appendChild(chat);
    wrap.appendChild(undo);
    return wrap;
  }

  return wrap;
}

function renderRenters(renters, decision) {
  list.innerHTML = '';
  renters.forEach((renter) => {
    const card = document.createElement('div');
    card.className = 'renter-card';

    const header = document.createElement('div');
    header.className = 'renter-header';

    const avatar = document.createElement('div');
    avatar.className = 'renter-avatar';
    if (renter.photo) {
      avatar.style.backgroundImage = `url(${JSON.stringify(String(renter.photo))})`;
    }

    const head = document.createElement('div');
    head.className = 'renter-head';
    const nameRow = document.createElement('div');
    nameRow.className = 'renter-name-row';
    const name = document.createElement('h3');
    name.textContent = `${renter.name}, ${renter.age}`;
    const score = document.createElement('span');
    score.className = 'renter-score';
    score.textContent = `${renter.matchScore}%`;
    nameRow.appendChild(name);
    nameRow.appendChild(score);
    const occ = document.createElement('div');
    occ.className = 'renter-meta';
    const parts = [renter.occupation];
    if (renter.movingFrom) parts.push(`עובר מ${renter.movingFrom}`);
    if (renter.budget) parts.push(`תקציב ₪${renter.budget.toLocaleString('he-IL')}`);
    occ.textContent = parts.filter(Boolean).join(' · ');

    head.appendChild(nameRow);
    head.appendChild(occ);

    header.appendChild(avatar);
    header.appendChild(head);

    const bio = document.createElement('p');
    bio.className = 'renter-bio';
    bio.textContent = renter.bio || '';

    card.appendChild(header);
    if (renter.bio) card.appendChild(bio);
    card.appendChild(actionsFor(renter, decision));

    list.appendChild(card);
  });
}

function render() {
  const grouped = decisionsByGroup();
  renderCounts(grouped);
  const target = activeTab === 'pending' ? grouped.pending : grouped.approved;
  if (target.length === 0) {
    renderEmpty(activeTab === 'pending' ? 'אין מתעניינים חדשים' : 'אין עדיין התאמות פעילות');
    return;
  }
  renderRenters(target, activeTab === 'pending' ? 'pending' : 'approved');
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    tabButtons.forEach((b) => {
      const isActive = b === btn;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    render();
  });
});

render();
