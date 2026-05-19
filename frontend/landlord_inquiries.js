import { renderBottomNav } from './src/nav.js';
import {
  approveRenter,
  getPropertyInterests,
  getRole,
  getUserProperties,
  rejectRenter,
} from './src/storage.js';

if (getRole() !== 'landlord') {
  window.location.replace('/swipe.html');
}

renderBottomNav('inquiries');

const list = document.getElementById('inquiries-list');
const subtitle = document.getElementById('inquiries-subtitle');

// Gather every renter still pending a decision, across all of the
// landlord's properties.
async function collectPending() {
  const items = [];
  const properties = await getUserProperties();
  for (const property of properties) {
    const interests = await getPropertyInterests(property.id);
    interests.pending.forEach((renter) => items.push({ property, renter }));
  }
  return items;
}

function renterMeta(renter) {
  const parts = [];
  if (renter.type) parts.push(renter.type);
  if (renter.city) parts.push(renter.city);
  if (renter.budget) parts.push(`תקציב ₪${Number(renter.budget).toLocaleString('he-IL')}`);
  return parts.join(' · ');
}

function renderEmpty() {
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const title = document.createElement('h3');
  title.textContent = 'אין פניות חדשות';
  const desc = document.createElement('p');
  desc.textContent = 'כשמישהו יחליק ימינה על אחת מהדירות שלך תקבל/י כאן הודעה.';
  const cta = document.createElement('a');
  cta.href = '/landlord.html';
  cta.textContent = 'לדירות שלי';
  empty.appendChild(title);
  empty.appendChild(desc);
  empty.appendChild(cta);
  list.appendChild(empty);
  subtitle.textContent = 'אין כרגע פניות פתוחות.';
}

async function render() {
  subtitle.textContent = 'טוען פניות…';
  const items = await collectPending();
  if (items.length === 0) {
    renderEmpty();
    return;
  }
  subtitle.textContent = `${items.length} ${items.length === 1 ? 'פנייה ממתינה' : 'פניות ממתינות'}`;
  list.innerHTML = '';

  items.forEach(({ property, renter }) => {
    const card = document.createElement('div');
    card.className = 'inquiry-card';

    const header = document.createElement('div');
    header.className = 'renter-header';
    const avatar = document.createElement('div');
    avatar.className = 'renter-avatar';
    const head = document.createElement('div');
    head.className = 'renter-head';

    const nameRow = document.createElement('div');
    nameRow.className = 'renter-name-row';
    const name = document.createElement('h3');
    name.textContent = renter.name;
    nameRow.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'renter-meta';
    meta.textContent = renterMeta(renter);

    head.appendChild(nameRow);
    head.appendChild(meta);

    header.appendChild(avatar);
    header.appendChild(head);

    const bio = document.createElement('p');
    bio.className = 'renter-bio';
    bio.textContent = renter.bio || '';

    const propLink = document.createElement('a');
    propLink.className = 'inquiry-property';
    propLink.href = `/landlord_property.html?id=${encodeURIComponent(property.id)}`;
    propLink.textContent = `על הדירה: ${property.title} · ${property.price}`;

    const actions = document.createElement('div');
    actions.className = 'renter-actions';
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'icon-btn reject';
    reject.title = 'דחה';
    reject.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    reject.addEventListener('click', async () => {
      reject.disabled = true;
      await rejectRenter(property.id, renter.id);
      render();
    });
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'icon-btn approve';
    approve.title = 'אשר';
    approve.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    approve.addEventListener('click', async () => {
      approve.disabled = true;
      await approveRenter(property.id, renter.id);
      render();
    });
    actions.appendChild(reject);
    actions.appendChild(approve);

    card.appendChild(header);
    if (renter.bio) card.appendChild(bio);
    card.appendChild(propLink);
    card.appendChild(actions);

    list.appendChild(card);
  });
}

render();
