/* Live chat via Socket.IO — attaches when RM_CHAT is set on the chat page.
   Relies on window.RM.socket (created in rm-core.js). */
(function () {
  if (!window.RM_CHAT || !window.RM || !window.RM.socket) return;

  const { conversationId, myId } = window.RM_CHAT;
  const socket = window.RM.socket;
  const msgArea = document.getElementById('chat-messages');
  const input = document.getElementById('msg-input');
  const sendBtn = document.getElementById('msg-send-btn');
  const typing = document.getElementById('chat-typing');

  if (!msgArea || !input || !sendBtn) return;

  msgArea.scrollTop = msgArea.scrollHeight;
  socket.emit('join_conversation', { conversation_id: conversationId });

  function formatTime(iso) {
    const d = new Date(iso || Date.now());
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function appendBubble(m) {
    if (msgArea.querySelector(`[data-mid="${m.id}"]`)) return;
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble ' + (m.sender_id === myId ? 'sent' : 'received');
    bubble.dataset.mid = m.id;
    bubble.innerHTML = window.RM.escapeHtml(m.body) +
      `<div class="message-time">${formatTime(m.created_at)}</div>`;
    msgArea.appendChild(bubble);
    msgArea.scrollTop = msgArea.scrollHeight;
  }

  socket.on('message:new', (m) => {
    if (m.conversation_id !== conversationId) return;
    appendBubble(m);
    if (m.sender_id !== myId) {
      socket.emit('read_receipt', { conversation_id: conversationId });
    }
  });

  let typingHideTimer = null;
  socket.on('typing', (data) => {
    if (data.conversation_id !== conversationId || data.user_id === myId) return;
    if (!typing) return;
    if (data.is_typing) {
      typing.hidden = false;
      clearTimeout(typingHideTimer);
      typingHideTimer = setTimeout(() => { typing.hidden = true; }, 3000);
    } else {
      typing.hidden = true;
    }
  });

  socket.on('read_receipt', (data) => {
    if (data.conversation_id !== conversationId) return;
    document.querySelectorAll('.message-bubble.sent').forEach(b => b.classList.add('read'));
  });

  let typingEmitTimer = null;
  input.addEventListener('input', () => {
    socket.emit('typing', { conversation_id: conversationId, is_typing: true });
    clearTimeout(typingEmitTimer);
    typingEmitTimer = setTimeout(() => {
      socket.emit('typing', { conversation_id: conversationId, is_typing: false });
    }, 1500);
  });

  function send() {
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    socket.emit('send_message', { conversation_id: conversationId, body });
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); send(); }
  });

  window.addEventListener('beforeunload', () => {
    socket.emit('leave_conversation', { conversation_id: conversationId });
  });
})();
