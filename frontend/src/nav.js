import { getRole } from './storage.js';

const RENTER_ITEMS = [
  {
    key: 'swipe',
    href: '/swipe.html',
    label: 'גלה',
    icon:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l2-2 7-7 7 7 2 2"></path><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10"></path></svg>',
  },
  {
    key: 'matches',
    href: '/matches.html',
    label: 'התאמות',
    icon:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
  },
  {
    key: 'profile',
    href: '/profile.html',
    label: 'פרופיל',
    icon:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  },
];

const LANDLORD_ITEMS = [
  {
    key: 'landlord',
    href: '/landlord.html',
    label: 'הדירות שלי',
    icon:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
  },
  {
    key: 'inquiries',
    href: '/landlord_inquiries.html',
    label: 'פניות',
    icon:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
  },
  {
    key: 'profile',
    href: '/profile.html',
    label: 'פרופיל',
    icon:
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  },
];

export function renderBottomNav(activeKey) {
  const host = document.getElementById('bottom-nav');
  if (!host) return;
  host.classList.add('bottom-nav');
  host.innerHTML = '';
  const items = getRole() === 'landlord' ? LANDLORD_ITEMS : RENTER_ITEMS;
  items.forEach((item) => {
    const a = document.createElement('a');
    a.className = 'nav-item' + (item.key === activeKey ? ' active' : '');
    a.href = item.href;
    a.innerHTML = item.icon;
    const label = document.createElement('span');
    label.textContent = item.label;
    a.appendChild(label);
    host.appendChild(a);
  });
}
