// Lightweight notifications: native browser Notification API when permitted,
// falls back to an in-app toast. Used for match alerts, AI replies while
// the tab is in the background, etc.

const PERMISSION_REQUESTED_KEY = 'rentmate_notif_permission_requested';

function supportsNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission() {
  if (!supportsNotifications()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!supportsNotifications()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const result = await Notification.requestPermission();
    try { localStorage.setItem(PERMISSION_REQUESTED_KEY, '1'); } catch (e) { /* ignore */ }
    return result;
  } catch (e) {
    return 'default';
  }
}

export function maybePromptOnce() {
  if (!supportsNotifications()) return;
  if (Notification.permission !== 'default') return;
  let already;
  try { already = localStorage.getItem(PERMISSION_REQUESTED_KEY); } catch (e) { already = null; }
  if (already) return;
  requestNotificationPermission();
}

function showToast(title, body) {
  const wrap = document.createElement('div');
  wrap.className = 'app-toast';
  const t = document.createElement('div');
  t.className = 'app-toast-title';
  t.textContent = title;
  wrap.appendChild(t);
  if (body) {
    const b = document.createElement('div');
    b.className = 'app-toast-body';
    b.textContent = body;
    wrap.appendChild(b);
  }
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  setTimeout(() => {
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 250);
  }, 3600);
}

export function notify(title, options = {}) {
  const { body = '', icon, tag, onclick } = options;
  if (supportsNotifications() && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon: icon || '/favicon.svg',
        tag,
        lang: 'he',
        dir: 'rtl',
      });
      if (typeof onclick === 'function') {
        n.onclick = (ev) => {
          ev.preventDefault();
          window.focus();
          onclick();
          n.close();
        };
      }
      return n;
    } catch (e) {
      // fall through to toast
    }
  }
  showToast(title, body);
  return null;
}
