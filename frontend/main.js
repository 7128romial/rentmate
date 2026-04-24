import { API_BASE, authHeaders, getUserId } from './src/config.js';

const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

function addMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
  msgDiv.appendChild(contentDiv);
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message ai typing-message';
  typingDiv.id = 'typing-indicator';
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content typing-indicator';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    contentDiv.appendChild(dot);
  }
  typingDiv.appendChild(contentDiv);
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const typingDiv = document.getElementById('typing-indicator');
  if (typingDiv) typingDiv.remove();
}

async function sendToAI(text) {
  if (!getUserId()) {
    setTimeout(() => {
      removeTypingIndicator();
      addMessage('שגיאה: לא מחובר למערכת.', 'ai');
    }, 1000);
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    });

    if (res.status === 401) {
      removeTypingIndicator();
      addMessage('ההפעלה פגה, התחבר שוב.', 'ai');
      setTimeout(() => (window.location.href = '/'), 1500);
      return;
    }

    if (!res.ok) {
      removeTypingIndicator();
      addMessage('סליחה, יש לי קצת עומס כרגע.', 'ai');
      return;
    }

    const data = await res.json();
    removeTypingIndicator();
    addMessage(data.response, 'ai');

    if (data.profile_complete) {
      setTimeout(() => (window.location.href = '/swipe.html'), 2500);
    }
  } catch (err) {
    console.error('API Error', err);
    removeTypingIndicator();
    addMessage('שגיאת תקשורת עם השרת.', 'ai');
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  chatInput.value = '';
  showTypingIndicator();
  sendToAI(text);
});

setTimeout(() => {
  showTypingIndicator();
  sendToAI('שלום, אני מחפש דירה');
}, 500);
