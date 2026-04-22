const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const AI_SCRIPT = [
  "היי! אני הסוכן החכם של RentMate. במקום שתמלא טופס ארוך, פשוט נדבר קצת. איך קוראים לך?",
  "נעים מאוד! באיזה עיר את/ה מחפש/ת דירה?",
  "מעולה. מה התקציב החודשי שלך פחות או יותר?",
  "הבנתי. את/ה מחפש/ת דירה לבד, עם שותפים, או עם בן/בת זוג?",
  "מעולה! יש לך חיות מחמד או בקשות מיוחדות? (מרפסת, חניה וכו')",
  "מושלם! למדתי מה את/ה אוהב/ת. אני מכין עבורך את הדירות הכי שוות. מוכן/ה?"
];

let scriptIndex = 0;
const userAnswers = [];

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

function simulateAIResponse() {
  if (scriptIndex >= AI_SCRIPT.length) {
    // Extract preferences
    const prefs = {
      name: userAnswers[0] || "משתמש",
      city: userAnswers[1] || "תל אביב",
      budget: userAnswers[2] || "4000",
      type: userAnswers[3] || "לבד",
      extras: userAnswers[4] || ""
    };
    localStorage.setItem('rentmate_prefs', JSON.stringify(prefs));

    // End of onboarding, redirect to swipe
    setTimeout(() => {
      window.location.href = '/swipe.html';
    }, 1500);
    return;
  }
  
  showTypingIndicator();
  
  setTimeout(() => {
    removeTypingIndicator();
    addMessage(AI_SCRIPT[scriptIndex], 'ai');
    scriptIndex++;
  }, 1000 + Math.random() * 1000);
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  
  addMessage(text, 'user');
  userAnswers.push(text);
  chatInput.value = '';
  
  simulateAIResponse();
});

// Start conversation
setTimeout(() => simulateAIResponse(), 500);
