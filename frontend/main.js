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
    const cityAns = userAnswers[1] || "תל אביב";
    const knownCities = ["תל אביב", "תל-אביב", "ירושלים", "חיפה", "רמת גן", "הרצליה", "ראשון לציון", "חולון", "פתח תקווה", "נתניה", "באר שבע", "גבעתיים", "כפר סבא", "רעננה"];
    let foundCity = "תל אביב";
    for (const c of knownCities) {
      if (cityAns.includes(c)) {
        foundCity = c;
        break;
      }
    }
    if(foundCity === "תל אביב" && !cityAns.includes("תל") && cityAns.length > 2 && cityAns.length < 15) {
        foundCity = cityAns.trim();
    }

    const prefs = {
      name: userAnswers[0] || "משתמש",
      city: foundCity,
      budget: userAnswers[2] || "4000",
      type: userAnswers[3] || "לבד",
      extras: userAnswers[4] || ""
    };
    localStorage.setItem('rentmate_prefs', JSON.stringify(prefs));

    const user_id = localStorage.getItem('rentmate_user_id');
    if (user_id) {
        fetch('https://rentmate-kgh9.onrender.com/api/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user_id, ...prefs })
        }).catch(err => console.error("API error", err));
    }

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
