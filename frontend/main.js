import { API_BASE, authHeaders, getToken } from './src/config.js';
import {
  setProfile,
  setRole,
  setSubrole,
  setFilterPrefs,
} from './src/storage.js';

const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

function appendMessage(text, sender) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  // Preserve newlines
  text.split('\n').forEach((line, i) => {
    if (i > 0) contentDiv.appendChild(document.createElement('br'));
    contentDiv.appendChild(document.createTextNode(line));
  });
  msgDiv.appendChild(contentDiv);
  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai typing-message';
  wrapper.id = 'typing-indicator';
  const content = document.createElement('div');
  content.className = 'message-content typing-indicator';
  for (let i = 0; i < 3; i++) {
    const d = document.createElement('div');
    d.className = 'typing-dot';
    content.appendChild(d);
  }
  wrapper.appendChild(content);
  messagesContainer.appendChild(wrapper);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

async function sendToAI(text) {
  showTyping();
  try {
    const res = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text })
    });
    removeTyping();
    const data = await res.json();
    
    if (data.error) {
      appendMessage(data.error, 'ai');
      return;
    }
    
    appendMessage(data.response, 'ai');
    
    if (data.profile_complete) {
      if (data.role) setRole(data.role);
      if (data.subrole) setSubrole(data.subrole);

      if (data.profile) {
        setProfile(data.profile);
        if (data.role !== 'landlord') {
          const prefs = {};
          if (data.profile.city) prefs.area = data.profile.city;
          const budget = Number(data.profile.budget);
          if (Number.isFinite(budget) && budget > 0) prefs.maxPrice = budget;
          if (Object.keys(prefs).length) setFilterPrefs(prefs);
        }
      }

      setTimeout(() => {
        if (data.role === 'landlord') {
          window.location.href = '/landlord.html';
        } else if (data.role === 'roommate') {
          if (data.subrole === 'host') {
             window.location.href = '/roommate_host.html';
          } else {
             window.location.href = '/roommate_seeker.html';
          }
        } else {
          window.location.href = '/swipe.html';
        }
      }, 2000);
    }
    
  } catch (err) {
    removeTyping();
    console.error(err);
    appendMessage("סליחה, אירעה שגיאה בחיבור לשרת.", 'ai');
  }
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  
  chatInput.value = '';
  appendMessage(text, 'user');
  
  sendToAI(text);
});

// Start the chat with an initial prompt
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    appendMessage("היי! אני ה-AI של RentMate 🤖\nקודם כל, איך קוראים לך?\nולאחר מכן, ספר/י לי על עצמך — את/ה מחפש/ת דירה? שותפים? או שאולי יש לך דירה שאת/ה רוצה להשכיר?", 'ai');
  }, 500);
});
