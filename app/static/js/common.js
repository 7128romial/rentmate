/* common.js — shared RM namespace: fetch wrapper with CSRF, toast, notifications */
(function () {
  const cfg = window.RM_CONFIG || {};

  async function apiFetch(url, options = {}) {
    const opts = Object.assign({ headers: {}, credentials: "same-origin" }, options);
    opts.headers = Object.assign({
      "X-CSRFToken": cfg.csrfToken || "",
      "Accept": "application/json",
    }, opts.headers);
    if (opts.body && !(opts.body instanceof FormData) && typeof opts.body === "object") {
      opts.body = JSON.stringify(opts.body);
      opts.headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, opts);
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
    if (!res.ok) {
      const msg = (body && body.error) || `שגיאה ${res.status}`;
      throw new Error(msg);
    }
    return body;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function toast(msg, type = "success") {
    const container = document.querySelector(".flash-container") || (() => {
      const c = document.createElement("div");
      c.className = "flash-container";
      document.body.appendChild(c);
      return c;
    })();
    const el = document.createElement("div");
    el.className = `flash flash-${type}`;
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.style.opacity = "0", 3000);
    setTimeout(() => el.remove(), 3400);
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  // ---------- Notifications panel ----------
  let notifPanelOpen = false;
  async function refreshNotifications() {
    try {
      const data = await apiFetch("/notifications/api/notifications");
      renderNotifications(data.items || []);
      const badge = document.getElementById("notif-badge");
      if (badge) badge.hidden = (data.unread || 0) === 0;
    } catch (e) { /* ignore */ }
  }

  function renderNotifications(items) {
    const list = document.getElementById("notif-list");
    if (!list) return;
    list.innerHTML = items.length ? "" : '<li class="notif-item"><div class="notif-body">אין התראות חדשות</div></li>';
    items.forEach(n => {
      const li = document.createElement("li");
      li.className = "notif-item" + (n.is_read ? "" : " unread");
      li.innerHTML = `
        <div class="notif-title">${escapeHtml(n.title)}</div>
        <div class="notif-body">${escapeHtml(n.body || "")}</div>
        <div class="notif-time">${new Date(n.created_at).toLocaleString("he-IL")}</div>`;
      li.addEventListener("click", () => {
        apiFetch(`/notifications/api/notifications/${n.id}/read`, { method: "POST" });
        li.classList.remove("unread");
        const dest = relatedUrl(n);
        if (dest) window.location.href = dest;
      });
      list.appendChild(li);
    });
  }

  function relatedUrl(n) {
    if (!n.related_entity_id) return null;
    switch (n.type) {
      case "new_message": return `/chat?conv=${n.related_entity_id}`;
      case "high_match":
      case "new_listing_in_area": return `/listings/${n.related_entity_id}`;
      default: return null;
    }
  }

  function toggleNotifPanel() {
    const panel = document.getElementById("notif-panel");
    if (!panel) return;
    notifPanelOpen = !notifPanelOpen;
    panel.hidden = !notifPanelOpen;
    if (notifPanelOpen) refreshNotifications();
  }

  async function markAllNotificationsRead() {
    await apiFetch("/notifications/api/notifications/read-all", { method: "POST" });
    document.querySelectorAll(".notif-item.unread").forEach(el => el.classList.remove("unread"));
    const badge = document.getElementById("notif-badge");
    if (badge) badge.hidden = true;
  }

  window.RM = Object.assign(window.RM || {}, {
    apiFetch, escapeHtml, toast, vibrate, fmtTime,
    refreshNotifications, toggleNotifPanel, markAllNotificationsRead,
  });

  // Close notif panel when clicking outside
  document.addEventListener("click", (e) => {
    if (!notifPanelOpen) return;
    const panel = document.getElementById("notif-panel");
    const btn = document.getElementById("notif-btn");
    if (panel && !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      panel.hidden = true;
      notifPanelOpen = false;
    }
  });

  // Pre-load initial unread count
  if (window.RM_CONFIG && window.RM_CONFIG.currentUser) refreshNotifications();
})();
