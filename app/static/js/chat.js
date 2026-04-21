/* chat.js — realtime chat UI (Firestore listener + HTTP send/read receipts)
   Falls back to polling if Firebase is unavailable. */
(function () {
  const cfg = (window.RM_CONFIG || {}).firebase || {};
  const data = window.RM_CHAT;
  if (!data) return;
  const { conversationId, myId, firestoreAvailable } = data;

  const msgArea = document.getElementById("chat-messages");
  const input = document.getElementById("msg-input");
  const sendBtn = document.getElementById("msg-send");
  const typingBar = document.getElementById("typing-indicator");

  function render(m) {
    if (msgArea.querySelector(`[data-mid="${m.id}"]`)) return;
    const bubble = document.createElement("div");
    bubble.dataset.mid = m.id;
    bubble.className = "bubble " + (m.sender_id === myId ? "sent" : "received");
    bubble.innerHTML = RM.escapeHtml(m.content) +
      `<span class="bubble-time">${RM.fmtTime(m.created_at)}</span>`;
    msgArea.appendChild(bubble);
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  async function loadInitial() {
    try {
      const res = await RM.apiFetch(`/chat/api/conversations/${conversationId}/messages`);
      msgArea.innerHTML = "";
      (res.items || []).forEach(render);
    } catch (e) { RM.toast(e.message, "error"); }
  }

  async function sendMessage() {
    const content = (input.value || "").trim();
    if (!content) return;
    input.value = "";
    try {
      const m = await RM.apiFetch(`/chat/api/conversations/${conversationId}/messages`, {
        method: "POST", body: { content },
      });
      render(m);
    } catch (e) { RM.toast(e.message, "error"); }
  }

  let typingTimer = null;
  function onTyping() {
    RM.apiFetch(`/chat/api/conversations/${conversationId}/typing`, {
      method: "POST", body: { typing: true },
    }).catch(() => {});
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      RM.apiFetch(`/chat/api/conversations/${conversationId}/typing`, {
        method: "POST", body: { typing: false },
      }).catch(() => {});
    }, 1500);
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  input.addEventListener("input", onTyping);

  loadInitial();

  // ---- Realtime listener via Firestore (loaded only if keys are present) ----
  if (firestoreAvailable && cfg.apiKey) {
    loadFirestore().then(fs => {
      if (!fs) return startPolling();   // SDK failed to load for some reason
      const convRef = fs.doc(fs.db, "conversations", String(conversationId));
      const msgsQ = fs.query(fs.collection(fs.db, "conversations", String(conversationId), "messages"),
                             fs.orderBy("created_at", "asc"));
      fs.onSnapshot(msgsQ, snap => {
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const m = change.doc.data();
            if (m && m.id) render(m);
          }
        });
      });
      fs.onSnapshot(convRef, snap => {
        const d = snap.data() || {};
        const typingMap = d.typing || {};
        const otherTyping = Object.entries(typingMap).some(([uid, val]) => Number(uid) !== myId && val);
        if (typingBar) typingBar.hidden = !otherTyping;
      });
    });
  } else {
    startPolling();
  }

  function startPolling() {
    setInterval(loadInitial, 4000);
  }

  async function loadFirestore() {
    try {
      const [{ initializeApp }, fsMod] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      ]);
      initializeApp({
        apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId,
        messagingSenderId: cfg.messagingSenderId, appId: cfg.appId,
      });
      const db = fsMod.getFirestore();
      return {
        db,
        doc: fsMod.doc, collection: fsMod.collection,
        query: fsMod.query, orderBy: fsMod.orderBy,
        onSnapshot: fsMod.onSnapshot,
      };
    } catch (e) { return null; }
  }
})();
