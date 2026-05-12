import { findDemoProperty, findRoommatePerson, findSharedListing } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { getMatch, getMatches, getRole, getProfile } from './src/storage.js';
import { API_BASE, getToken, getUserId } from './src/config.js';

const myUserId = parseInt(getUserId(), 10);

function resolveContext() {
  const params = new URLSearchParams(window.location.search);
  const personId = params.get('person');
  if (personId) {
    const person = findRoommatePerson(personId);
    if (person) {
      return {
        isP2P: false,
        title: `${person.name}, ${person.age}`,
        subtitle: person.targetArea ? `מחפש/ת באזור ${person.targetArea}` : person.occupation || 'הותאם היום',
        avatar: person.photo,
        location: null,
      };
    }
  }
  const propId = params.get('id');
  const renterId = params.get('renter') || myUserId; // If landlord views, renter is in URL. If renter views, renter is self.

  if (propId) {
    const fromMatches = getMatch(propId);
    const property = fromMatches || findDemoProperty(propId) || findSharedListing(propId);
    if (property) {
      return {
        isP2P: true,
        propertyId: propId,
        renterId: renterId,
        title: property.title || 'דירה',
        subtitle: property.address || 'הותאם היום',
        avatar: property.image,
        location: property,
      };
    }
  }
  const matches = getMatches();
  if (matches.length) {
    const m = matches[0];
    return {
      isP2P: true,
      propertyId: m.id,
      renterId: myUserId,
      title: m.title || 'דירה',
      subtitle: m.address || 'הותאם היום',
      avatar: m.image,
      location: m,
    };
  }
  const fallback = findDemoProperty('demo-1');
  return {
    isP2P: false,
    title: fallback.title,
    subtitle: fallback.address,
    avatar: fallback.image,
    location: fallback,
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

if (ctx.isP2P && window.io) {
  const socket = io(API_BASE);

  socket.on('connect', () => {
    socket.emit('join_chat', {
      token: getToken(),
      property_id: ctx.propertyId,
      renter_id: ctx.renterId
    });
  });

  socket.on('chat_history', (data) => {
    messages.innerHTML = '';
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach((msg) => {
        const role = msg.sender_id === myUserId ? 'user' : 'other';
        appendMessage(msg.content, role);
      });
    } else {
      appendMessage('היי! ראיתי שעשינו מאץ\'. עדיין רלוונטי?', 'other');
    }
  });

  socket.on('new_message', (msg) => {
    if (msg.sender_id !== myUserId) {
      appendMessage(msg.content, 'other');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    
    appendMessage(value, 'user');
    socket.emit('send_message', {
      token: getToken(),
      property_id: ctx.propertyId,
      renter_id: ctx.renterId,
      content: value
    });
    input.value = '';
  });

  const btnGenerateLease = document.getElementById('btn-generate-lease');
  const leaseModal = document.getElementById('lease-modal');
  const closeLeaseModal = document.getElementById('close-lease-modal');
  const leaseContent = document.getElementById('lease-content');
  const btnPrintLease = document.getElementById('print-lease');

  btnGenerateLease.style.display = 'block';

  btnGenerateLease.addEventListener('click', async () => {
    leaseModal.style.display = 'flex';
    leaseContent.innerHTML = 'טוען... ה-AI שלנו מכין את חוזה השכירות... 📄';

    const role = getRole();
    const leaseType = role === 'roommate' ? 'roommate' : 'standard';
    const myProfile = getProfile() || {};
    const myName = (myProfile.name || '').trim();
    const otherName = (ctx.title || '').split(',')[0].trim();
    const isLandlordSide = role === 'landlord' || role === 'roommate';
    const landlordName = isLandlordSide ? myName : otherName;
    const renterName = isLandlordSide ? otherName : myName;

    try {
      const res = await fetch(`${API_BASE}/api/lease/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          property: ctx.location || {},
          lease_type: leaseType,
          landlord_name: landlordName,
          renter_name: renterName
        })
      });

      if (res.ok) {
        const data = await res.json();
        leaseContent.innerHTML = data.html;
      } else {
        const body = await res.text().catch(() => '');
        console.error('Lease generation failed', res.status, body);
        leaseContent.innerHTML = 'לא הצלחנו ליצור את החוזה כרגע. נסי שוב בעוד רגע.';
      }
    } catch (e) {
      console.error(e);
      leaseContent.innerHTML = 'שגיאת תקשורת. בדקי שהשרת זמין ונסי שוב.';
    }
  });

  closeLeaseModal.addEventListener('click', () => {
    leaseModal.style.display = 'none';
  });

  btnPrintLease.addEventListener('click', () => {
    const printWindow = window.open('', '', 'height=800,width=800');
    printWindow.document.write('<html><head><title>חוזה שכירות</title>');
    printWindow.document.write('<style>body { direction: rtl; text-align: right; font-family: serif; padding: 40px; line-height: 1.6; } h1, h2 { text-align: center; }</style>');
    printWindow.document.write('</head><body>');
    printWindow.document.write(leaseContent.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });

} else {
  // Fallback demo mode
  messages.innerHTML = '';
  appendMessage('היי! ראיתי שעשינו מאץ\'. עדיין רלוונטי?', 'other');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    appendMessage(value, 'user');
    input.value = '';
    setTimeout(() => {
      appendMessage('אני במצב דמו, אבל תדמיין שעניתי לך!', 'other');
    }, 1000);
  });
}
