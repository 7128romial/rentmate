import { findDemoProperty, findRoommatePerson } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { getMatch, getMatches, getRoommateMatches } from './src/storage.js';

const params = new URLSearchParams(window.location.search);
const personId = params.get('person');
const propId = params.get('id');

const subtitle = document.getElementById('match-subtitle');
const avatar = document.getElementById('match-avatar');
const mapHost = document.getElementById('match-map-host');
const chatBtn = document.getElementById('match-chat-btn');
const continueBtn = document.getElementById('match-continue-btn');

if (personId) {
  // Roommate person match
  const fromMatches = getRoommateMatches().find((p) => String(p.id) === String(personId));
  const person = fromMatches || findRoommatePerson(personId);
  if (person) {
    if (subtitle) subtitle.textContent = `מצאתם זה את זה — ${person.name}, ${person.age}`;
    if (avatar && person.photo) {
      avatar.style.backgroundImage = `url(${JSON.stringify(String(person.photo))})`;
    }
    if (mapHost) mapHost.style.display = 'none';
  }
  chatBtn.addEventListener('click', () => {
    window.location.href = `/realtime_chat.html?person=${encodeURIComponent(personId)}`;
  });
  continueBtn.addEventListener('click', () => {
    window.location.href = '/roommate_seeker.html';
  });
} else {
  // Property match
  const property = (propId && (getMatch(propId) || findDemoProperty(propId)))
    || getMatches()[0]
    || findDemoProperty('demo-1');

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
}
