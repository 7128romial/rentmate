import { findDemoProperty } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { getMatch, getMatches } from './src/storage.js';

function resolveProperty() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) return getMatch(id) || findDemoProperty(id);
  const matches = getMatches();
  if (matches.length) return matches[0];
  return findDemoProperty('demo-1');
}

const property = resolveProperty();

if (property) {
  document.getElementById('chat-title').textContent = property.title || 'דירה';
  if (property.address) {
    document.getElementById('chat-subtitle').textContent = property.address;
  }
  const avatar = document.getElementById('chat-avatar');
  if (property.image) {
    avatar.style.backgroundImage = `url(${JSON.stringify(String(property.image))})`;
    avatar.style.backgroundSize = 'cover';
  }
  renderMap(document.getElementById('chat-map-host'), property, { zoom: 16 });
}

const form = document.querySelector('.chat-input-area');
const input = document.getElementById('chat-input');
const messages = document.getElementById('realtime-messages');

function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message user';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = text;
  wrapper.appendChild(content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  appendUserMessage(value);
  input.value = '';
});
