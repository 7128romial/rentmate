import { renderBottomNav } from './src/nav.js';
import { DEMO_MY_LISTING, getMyListingInterestedPeople } from './src/demo.js';
import {
  approveHostInterest,
  getHostInterestDecision,
  getRole,
  getSubrole,
  getUserListing,
  rejectHostInterest,
  undoHostInterest,
} from './src/storage.js';

if (getRole() !== 'roommate' || getSubrole() !== 'host') {
  window.location.replace('/roommate_choice.html');
}

renderBottomNav('roommate-host');

const listing = getUserListing() || DEMO_MY_LISTING;
const listingHost = document.getElementById('my-listing-card');
const list = document.getElementById('people-list');
const subtitle = document.getElementById('host-subtitle');
const tabButtons = document.querySelectorAll('.tab');

let activeTab = 'pending';

function renderListingCard() {
  listingHost.innerHTML = '';
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (listing.image) {
    thumb.style.backgroundImage = `url(${JSON.stringify(String(listing.image))})`;
  }
  const body = document.createElement('div');
  body.className = 'body';
  const h3 = document.createElement('h3');
  h3.textContent = listing.title;
  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = `${listing.price} · ${listing.rooms} חד׳, ${listing.area} מ״ר`;
  const addr = document.createElement('div');
  addr.className = 'meta';
  addr.textContent = listing.address ? `📍 ${listing.address}` : '';
  body.appendChild(h3);
  body.appendChild(price);
  if (listing.address) body.appendChild(addr);
  listingHost.appendChild(thumb);
  listingHost.appendChild(body);
}

function decisionsByGroup() {
  const grouped = { pending: [], approved: [], rejected: [] };
  getMyListingInterestedPeople().forEach((person) => {
    const decision = getHostInterestDecision(person.id);
    grouped[decision].push(person);
  });
  return grouped;
}

function renderCounts(grouped) {
  document.getElementById('count-pending').textContent = grouped.pending.length;
  document.getElementById('count-approved').textContent = grouped.approved.length;
}

function renderEmpty(message, hint) {
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const h3 = document.createElement('h3');
  h3.textContent = message;
  const desc = document.createElement('p');
  desc.textContent = hint;
  empty.appendChild(h3);
  empty.appendChild(desc);
  list.appendChild(empty);
}

function actionsFor(person, decision) {
  const wrap = document.createElement('div');
  wrap.className = 'renter-actions';
  if (decision === 'pending') {
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'icon-btn reject';
    reject.title = 'דחה';
    reject.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    reject.addEventListener('click', () => {
      rejectHostInterest(person.id);
      render();
    });

    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'icon-btn approve';
    approve.title = 'אשר';
    approve.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    approve.addEventListener('click', () => {
      approveHostInterest(person.id);
      render();
    });

    wrap.appendChild(reject);
    wrap.appendChild(approve);
    return wrap;
  }
  if (decision === 'approved') {
    const chat = document.createElement('a');
    chat.className = 'btn-primary chat-btn';
    chat.href = `/realtime_chat.html?person=${encodeURIComponent(person.id)}`;
    chat.textContent = 'שלח הודעה';

    const undo = document.createElement('button');
    undo.type = 'button';
    undo.className = 'btn-ghost';
    undo.textContent = 'בטל אישור';
    undo.addEventListener('click', () => {
      undoHostInterest(person.id);
      render();
    });

    wrap.appendChild(chat);
    wrap.appendChild(undo);
  }
  return wrap;
}

function renderPeople(people, decision) {
  list.innerHTML = '';
  people.forEach((person) => {
    const card = document.createElement('div');
    card.className = 'renter-card';

    const header = document.createElement('div');
    header.className = 'renter-header';
    const avatar = document.createElement('div');
    avatar.className = 'renter-avatar';
    if (person.photo) {
      avatar.style.backgroundImage = `url(${JSON.stringify(String(person.photo))})`;
    }
    const head = document.createElement('div');
    head.className = 'renter-head';

    const nameRow = document.createElement('div');
    nameRow.className = 'renter-name-row';
    const name = document.createElement('h3');
    name.textContent = `${person.name}, ${person.age}`;
    const score = document.createElement('span');
    score.className = 'renter-score';
    score.textContent = `${person.matchScore}%`;
    nameRow.appendChild(name);
    nameRow.appendChild(score);

    const meta = document.createElement('div');
    meta.className = 'renter-meta';
    const parts = [person.occupation];
    if (person.budget) parts.push(`תקציב ₪${person.budget.toLocaleString('he-IL')}`);
    if (person.targetArea) parts.push(person.targetArea);
    meta.textContent = parts.filter(Boolean).join(' · ');

    head.appendChild(nameRow);
    head.appendChild(meta);
    header.appendChild(avatar);
    header.appendChild(head);

    const bio = document.createElement('p');
    bio.className = 'renter-bio';
    bio.textContent = person.bio || '';

    const lifestyle = document.createElement('p');
    lifestyle.className = 'renter-lifestyle';
    if (person.lifestyle) lifestyle.textContent = `🎯 ${person.lifestyle}`;

    card.appendChild(header);
    if (person.bio) card.appendChild(bio);
    if (person.lifestyle) card.appendChild(lifestyle);
    card.appendChild(actionsFor(person, decision));
    list.appendChild(card);
  });
}

function render() {
  renderListingCard();
  const grouped = decisionsByGroup();
  renderCounts(grouped);
  subtitle.textContent = `${grouped.pending.length} מתעניינים חדשים · ${grouped.approved.length} התאמות`;
  const target = activeTab === 'pending' ? grouped.pending : grouped.approved;
  if (target.length === 0) {
    renderEmpty(
      activeTab === 'pending' ? 'אין מתעניינים חדשים' : 'עדיין אין התאמות',
      activeTab === 'pending'
        ? 'כשמישהו יחליק ימינה על הליסטינג שלך תקבל/י כאן הודעה.'
        : 'אישרו פרופיל מהלשונית "מתעניינים" כדי להתחיל שיחה.',
    );
    return;
  }
  renderPeople(target, activeTab === 'pending' ? 'pending' : 'approved');
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
