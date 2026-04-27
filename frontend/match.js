import { findDemoProperty } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { getMatch, getMatches } from './src/storage.js';

function resolveProperty() {
  const id = new URLSearchParams(window.location.search).get('id');
  if (id) {
    return getMatch(id) || findDemoProperty(id);
  }
  const matches = getMatches();
  if (matches.length) return matches[0];
  return findDemoProperty('demo-1');
}

const property = resolveProperty();

if (property) {
  const subtitle = document.getElementById('match-subtitle');
  if (subtitle && property.title) {
    subtitle.textContent = `מצאתם זה את זה — ${property.title}`;
  }
  const avatar = document.getElementById('match-avatar');
  if (avatar && property.image) {
    avatar.style.backgroundImage = `url(${JSON.stringify(String(property.image))})`;
  }
  renderMap(document.getElementById('match-map-host'), property, { zoom: 15 });
}

document.getElementById('match-chat-btn').addEventListener('click', () => {
  const id = property && property.id ? `?id=${encodeURIComponent(property.id)}` : '';
  window.location.href = `/realtime_chat.html${id}`;
});
