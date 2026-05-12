import { findDemoProperty, findRoommatePerson, findSharedListing } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { getMatch, getMatches } from './src/storage.js';
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

  const isNumericId = (v) => /^\d+$/.test(String(v ?? ''));

  function buildTemplateLease(property) {
    const today = new Date().toLocaleDateString('he-IL');
    const address = property?.address || property?.location || '____________';
    const price = property?.price || (property?.price_max ? `₪${property.price_max}/חודש` : '____________');
    const rooms = property?.rooms ?? '___';
    return `
      <h1 style="text-align:center">חוזה שכירות בלתי מוגנת</h1>
      <p style="text-align:center">נחתם ביום ${today}</p>
      <h2>הצדדים</h2>
      <p><strong>המשכיר:</strong> __________________ (ת.ז. __________)</p>
      <p><strong>השוכר:</strong> __________________ (ת.ז. __________)</p>
      <h2>1. הנכס</h2>
      <p>הדירה הנמצאת בכתובת: <strong>${address}</strong>, בת ${rooms} חדרים.</p>
      <h2>2. תקופת השכירות</h2>
      <p>תקופת השכירות תהיה 12 חודשים, החל מ-__________ ועד __________.</p>
      <h2>3. דמי שכירות</h2>
      <p>השוכר ישלם למשכיר סך של <strong>${price}</strong>, ב-1 לכל חודש קלנדרי.</p>
      <h2>4. פיקדון ובטחונות</h2>
      <p>השוכר יפקיד בידי המשכיר ערבות בנקאית או צ'ק ביטחון בגובה דמי שכירות של 3 חודשים.</p>
      <h2>5. תשלומי חובה</h2>
      <p>השוכר יישא בתשלומי חשמל, מים, גז, ארנונה ועד בית.</p>
      <h2>6. תחזוקה</h2>
      <p>השוכר מתחייב לשמור על הנכס במצב תקין. תיקוני בלאי סביר על חשבון המשכיר; תיקונים שמקורם בנזק שגרם השוכר — על חשבונו.</p>
      <h2>7. שימוש</h2>
      <p>הנכס ישמש למגורים בלבד. אסור להשכיר בשכירות-משנה ללא אישור המשכיר בכתב.</p>
      <h2>חתימות</h2>
      <p>חתימת המשכיר: __________________</p>
      <p>חתימת השוכר: __________________</p>
      <p>תאריך: __________________</p>
    `;
  }

  btnGenerateLease.addEventListener('click', async () => {
    leaseModal.style.display = 'flex';

    if (!isNumericId(ctx.propertyId)) {
      leaseContent.innerHTML = buildTemplateLease(ctx.location);
      return;
    }

    leaseContent.innerHTML = 'טוען... ה-AI שלנו מכין את חוזה השכירות... 📄';

    try {
      const res = await fetch(`${API_BASE}/api/landlord/properties/${ctx.propertyId}/generate_lease`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ renter_id: ctx.renterId })
      });

      if (res.ok) {
        const data = await res.json();
        leaseContent.innerHTML = data.html;
      } else {
        leaseContent.innerHTML = buildTemplateLease(ctx.location);
      }
    } catch (e) {
      console.error(e);
      leaseContent.innerHTML = buildTemplateLease(ctx.location);
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
