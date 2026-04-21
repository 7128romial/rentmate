/* global io */
/* RentMate shared client namespace: one Socket.IO connection per tab, notification bell,
   helpers used by chat-socket.js and match-celebration.js. */
(function () {
  if (!window.RM_CURRENT_USER) return;

  const socket = io({ transports: ['websocket', 'polling'] });

  const notifList = document.getElementById('notif-list');
  const notifCount = document.getElementById('notif-count');
  const notifPanel = document.getElementById('notif-panel');

  function updateNotifCount(n) {
    if (!notifCount) return;
    if (n > 0) {
      notifCount.textContent = n;
      notifCount.hidden = false;
    } else {
      notifCount.hidden = true;
    }
  }

  function renderNotif(n) {
    if (!notifList) return;
    const li = document.createElement('li');
    li.className = 'notif-item' + (n.is_read ? '' : ' unread');
    li.innerHTML = `
      <div class="notif-msg">${escapeHtml(n.message || '')}</div>
      <div class="notif-time">${new Date(n.created_at).toLocaleString('he-IL')}</div>
    `;
    li.addEventListener('click', () => {
      fetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
      li.classList.remove('unread');
      if (n.type === 'message' && n.payload && n.payload.conversation_id) {
        window.location.href = '/chat?conv=' + n.payload.conversation_id;
      } else if (n.type === 'match') {
        window.location.href = '/matches';
      }
    });
    notifList.prepend(li);
  }

  async function refreshNotifications() {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (notifList) notifList.innerHTML = '';
      data.items.forEach(renderNotif);
      updateNotifCount(data.unread);
    } catch (e) { /* ignore */ }
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  socket.on('connect', () => { /* joined user:<id> room server-side */ });
  socket.on('notification:new', (n) => {
    renderNotif(n);
    const current = parseInt(notifCount && notifCount.textContent || '0', 10) || 0;
    updateNotifCount(current + 1);
    if (window.showToast) window.showToast(n.message || 'התראה חדשה', 'info');
  });

  window.RM = Object.assign(window.RM || {}, {
    socket,
    escapeHtml,
    toggleNotifPanel() {
      if (!notifPanel) return;
      notifPanel.hidden = !notifPanel.hidden;
      if (!notifPanel.hidden) refreshNotifications();
    },
    markAllRead() {
      fetch('/api/notifications/read-all', { method: 'POST' })
        .then(() => {
          document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
          updateNotifCount(0);
        });
    },
    refreshNotifications,
  });

  refreshNotifications();
})();
