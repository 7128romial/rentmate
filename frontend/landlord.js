import { renderBottomNav } from './src/nav.js';
import { getInterestedRenterIds } from './src/demo.js';
import {
  getRenterDecision,
  getRole,
  getUserProperties,
  getUserPropertyInterests,
} from './src/storage.js';

if (getRole() !== 'landlord') {
  window.location.replace('/swipe.html');
}

renderBottomNav('landlord');

const list = document.getElementById('landlord-list');
const subtitle = document.getElementById('landlord-subtitle');

function countsFor(propertyId) {
  const ids = [
    ...getInterestedRenterIds(propertyId),
    ...getUserPropertyInterests(propertyId),
  ];
  let pending = 0;
  let approved = 0;
  ids.forEach((rid) => {
    const decision = getRenterDecision(propertyId, rid);
    if (decision === 'approved') approved += 1;
    else if (decision === 'pending') pending += 1;
  });
  return { pending, approved, total: ids.length };
}

function render() {
  list.innerHTML = '';
  let totalPending = 0;
  let totalApproved = 0;

  const all = getUserProperties();
  if (all.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const h = document.createElement('h3');
    h.textContent = 'עדיין אין דירות';
    const p = document.createElement('p');
    p.textContent = 'הוסיפי את הדירה הראשונה שלך כדי להתחיל לקבל פניות.';
    const cta = document.createElement('a');
    cta.href = '/landlord_add.html';
    cta.textContent = '+ הוסף דירה';
    empty.appendChild(h);
    empty.appendChild(p);
    empty.appendChild(cta);
    list.appendChild(empty);
    subtitle.textContent = 'אין עדיין דירות.';
    return;
  }

  all.forEach((property) => {
    const { pending, approved } = countsFor(property.id);
    totalPending += pending;
    totalApproved += approved;

    const card = document.createElement('a');
    card.className = 'landlord-card';
    card.href = `/landlord_property.html?id=${encodeURIComponent(property.id)}`;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (property.image) {
      thumb.style.backgroundImage = `url(${JSON.stringify(String(property.image))})`;
    }

    const body = document.createElement('div');
    body.className = 'body';

    const h3 = document.createElement('h3');
    h3.textContent = property.title;

    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = property.price;

    const addr = document.createElement('div');
    addr.className = 'meta';
    addr.textContent = property.address ? `📍 ${property.address}` : '';

    const stats = document.createElement('div');
    stats.className = 'landlord-stats';
    const pendingPill = document.createElement('span');
    pendingPill.className = 'stat pending';
    pendingPill.textContent = `${pending} מתעניינים חדשים`;
    const approvedPill = document.createElement('span');
    approvedPill.className = 'stat approved';
    approvedPill.textContent = `${approved} התאמות`;
    stats.appendChild(pendingPill);
    stats.appendChild(approvedPill);

    body.appendChild(h3);
    body.appendChild(price);
    if (property.address) body.appendChild(addr);
    body.appendChild(stats);

    card.appendChild(thumb);
    card.appendChild(body);
    list.appendChild(card);
  });

  subtitle.textContent = `${totalPending} פניות חדשות · ${totalApproved} התאמות פעילות`;
}

render();
