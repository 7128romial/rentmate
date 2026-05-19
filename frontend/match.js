import { renderMap } from './src/maps.js';
import { getMatch, getMatches } from './src/storage.js';

const params = new URLSearchParams(window.location.search);
const propId = params.get('id');

const subtitle = document.getElementById('match-subtitle');
const avatar = document.getElementById('match-avatar');
const mapHost = document.getElementById('match-map-host');
const chatBtn = document.getElementById('match-chat-btn');
const continueBtn = document.getElementById('match-continue-btn');

// Property match
const property = (propId && getMatch(propId)) || getMatches()[0] || null;

if (property) {
  if (subtitle && property.title) {
    subtitle.textContent = `מצאתם זה את זה — ${property.title}`;
  }
  if (avatar && property.image) {
    avatar.style.backgroundImage = `url(${JSON.stringify(String(property.image))})`;
  }
  renderMap(mapHost, property, { zoom: 15 });
}

chatBtn.addEventListener('click', () => {
  const q = property && property.id ? `?id=${encodeURIComponent(property.id)}` : '';
  window.location.href = `/realtime_chat.html${q}`;
});
continueBtn.addEventListener('click', () => {
  window.location.href = '/swipe.html';
});
