const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const user_id = localStorage.getItem('rentmate_user_id');

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
  contentDiv.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  typingDiv.appendChild(contentDiv);
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
  const typingDiv = document.getElementById('typing-indicator');
  if (typingDiv) {
    typingDiv.remove();
  }
}

async function sendToAI(text) {
  if (!user_id) {
    // Fallback if not logged in
    setTimeout(() => {
        removeTypingIndicator();
        addMessage("שגיאה: לא מחובר למערכת.", 'ai');
    }, 1000);
    return;
  }
  
  try {
    const res = await fetch('https://rentmate-kgh9.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user_id, text: text })
    });
    
    if (res.ok) {
        const data = await res.json();
        removeTypingIndicator();
        addMessage(data.response, 'ai');
        
        if (data.profile_complete) {
            setTimeout(() => {
              window.location.href = '/swipe.html';
            }, 2500);
        }
    } else {
        removeTypingIndicator();
        addMessage("סליחה, יש לי קצת עומס כרגע.", 'ai');
    }
  } catch (err) {
    console.error("API Error", err);
    removeTypingIndicator();
    addMessage("שגיאת תקשורת עם השרת.", 'ai');
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

// Start conversation with a dummy trigger to let AI introduce itself
setTimeout(() => {
    showTypingIndicator();
    sendToAI("שלום, אני מחפש דירה"); // trigger initial message
}, 500);
