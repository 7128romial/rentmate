import { findDemoProperty, findRoommatePerson, findSharedListing } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { addChatMessage, getChatMessages, getMatch, getMatches } from './src/storage.js';

function resolveContext() {
  const params = new URLSearchParams(window.location.search);
  const personId = params.get('person');
  if (personId) {
    const person = findRoommatePerson(personId);
    if (person) {
      return {
        chatId: `person:${person.id}`,
        title: `${person.name}, ${person.age}`,
        subtitle: person.targetArea ? `מחפש/ת באזור ${person.targetArea}` : person.occupation || 'הותאם היום',
        avatar: person.photo,
        location: null,
        opener: 'היי! ראיתי שעשינו מאץ\'. עדיין מחפש/ת שותף?',
      };
    }
  }
  const propId = params.get('id');
  if (propId) {
    const fromMatches = getMatch(propId);
    const property = fromMatches || findDemoProperty(propId) || findSharedListing(propId);
    if (property) {
      return {
        chatId: `property:${property.id}`,
        title: property.title || 'דירה',
        subtitle: property.address || 'הותאם היום',
        avatar: property.image,
        location: property,
        opener: 'היי! ראיתי שעשינו מאץ\'. עדיין רלוונטי?',
      };
    }
  }
  const matches = getMatches();
  if (matches.length) {
    const m = matches[0];
    return {
      chatId: `property:${m.id}`,
      title: m.title || 'דירה',
      subtitle: m.address || 'הותאם היום',
      avatar: m.image,
      location: m,
      opener: 'היי! ראיתי שעשינו מאץ\'. עדיין רלוונטי?',
    };
  }
  const fallback = findDemoProperty('demo-1');
  return {
    chatId: `property:${fallback.id}`,
    title: fallback.title,
    subtitle: fallback.address,
    avatar: fallback.image,
    location: fallback,
    opener: 'היי! ראיתי שעשינו מאץ\'. עדיין רלוונטי?',
  };
}

const ctx = resolveContext();

document.getElementById('chat-title').textContent = ctx.title;
document.getElementById('chat-subtitle').textContent = ctx.subtitle;
const avatar = document.getElementById('chat-avatar');
if (ctx.avatar) {
  avatar.style.backgroundImage = `url(${JSON.stringify(String(ctx.avatar))})`;
  avatar.style.backgroundSize = 'cover';
  avatar.style.backgroundPosition = 'center';
}
if (ctx.location) renderMap(document.getElementById('chat-map-host'), ctx.location, { zoom: 16 });

const form = document.querySelector('.chat-input-area');
const input = document.getElementById('chat-input');
const messages = document.getElementById('realtime-messages');

function appendMessage(text, role) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role === 'user' ? 'user' : 'ai'}`;
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = text;
  wrapper.appendChild(content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function renderHistory() {
  messages.innerHTML = '';
  const history = getChatMessages(ctx.chatId);
  if (history.length === 0) {
    addChatMessage(ctx.chatId, { role: 'other', content: ctx.opener });
  }
  getChatMessages(ctx.chatId).forEach((msg) => appendMessage(msg.content, msg.role));
}

const REPLIES = [
  'נשמע מצוין! מתי נוח לך לבוא לראות?',
  'אני זמין/ה הערב או מחר אחה״צ.',
  'יש שאלות נוספות לפני שנתאם?',
  'אגב, החזקת שיכלול את חשבונות החשמל והמים.',
  'מה החלטת? אני רוצה לדעת אם להתקדם איתך.',
];
let replyIndex = 0;

function showTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai typing-message';
  wrapper.id = 'typing-indicator';
  const content = document.createElement('div');
  content.className = 'message-content typing-indicator';
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    content.appendChild(dot);
  }
  wrapper.appendChild(content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

function hideTyping() {
  const t = document.getElementById('typing-indicator');
  if (t) t.remove();
}

function autoReply() {
  showTyping();
  setTimeout(() => {
    hideTyping();
    const reply = REPLIES[replyIndex % REPLIES.length];
    replyIndex += 1;
    addChatMessage(ctx.chatId, { role: 'other', content: reply });
    appendMessage(reply, 'other');
  }, 900 + Math.random() * 700);
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  addChatMessage(ctx.chatId, { role: 'user', content: value });
  appendMessage(value, 'user');
  input.value = '';
  autoReply();
});

renderHistory();
