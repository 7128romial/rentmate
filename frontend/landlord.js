import { renderBottomNav } from './src/nav.js';
import { getInterestedRenterIds } from './src/demo.js';
import {
  getRenterDecision,
  getRole,
  getUserProperties,
  getUserPropertyInterests,
  setUserPropertyStatus,
  PROPERTY_STATUSES,
} from './src/storage.js';

if (getRole() !== 'landlord') {
  window.location.replace('/swipe.html');
}

renderBottomNav('landlord');

const list = document.getElementById('landlord-list');
const subtitle = document.getElementById('landlord-subtitle');

const STATUS_LABELS = {
  available: 'פנויה',
  rented: 'מושכרת',
  pending: 'ממתינה לאישור',
  off_market: 'לא בשוק',
};

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

let openMenu = null;

function closeMenu() {
  if (openMenu) {
    openMenu.remove();
    openMenu = null;
  }
}

document.addEventListener('click', closeMenu);

function buildStatusMenu(propertyId, currentStatus, anchor) {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = 'status-menu';

  PROPERTY_STATUSES.forEach((status) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.status = status;
    if (status === currentStatus) btn.setAttribute('aria-current', 'true');

    const dot = document.createElement('span');
    dot.className = `status-badge ${status}`;
    dot.style.padding = '0';
    dot.style.background = 'transparent';
    dot.style.border = 'none';

    const label = document.createElement('span');
    label.textContent = STATUS_LABELS[status];

    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setUserPropertyStatus(propertyId, status);
      closeMenu();
      render();
    });
    menu.appendChild(btn);
  });

  document.body.appendChild(menu);
  openMenu = menu;

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
  menu.style.left = `${rect.left + window.scrollX}px`;
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

    const status = STATUS_LABELS[property.status] ? property.status : 'available';

    const card = document.createElement('a');
    card.className = 'landlord-card';
    card.href = `/landlord_property.html?id=${encodeURIComponent(property.id)}`;
    card.style.position = 'relative';

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

    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = `status-badge ${status}`;
    badge.textContent = STATUS_LABELS[status];
    badge.style.position = 'absolute';
    badge.style.top = '12px';
    badge.style.left = '12px';
    badge.title = 'שינוי סטטוס';
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      buildStatusMenu(property.id, status, badge);
    });

    body.appendChild(h3);
    body.appendChild(price);
    if (property.address) body.appendChild(addr);
    body.appendChild(stats);

    card.appendChild(thumb);
    card.appendChild(body);
    card.appendChild(badge);
    list.appendChild(card);
  });

  subtitle.textContent = `${totalPending} פניות חדשות · ${totalApproved} התאמות פעילות`;
}

render();
