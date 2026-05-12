import { findDemoProperty, findRoommatePerson, findSharedListing } from './src/demo.js';
import { renderMap } from './src/maps.js';
import { getMatch, getMatches, getRole, getSubrole, getProfile, getChatMessages, addChatMessage } from './src/storage.js';
import { API_BASE, getToken, getUserId } from './src/config.js';
import { notify, maybePromptOnce } from './src/notify.js';

maybePromptOnce();

const myUserId = parseInt(getUserId(), 10);

const chatId = (() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('person')) return `person:${params.get('person')}`;
  if (params.get('id')) return `property:${params.get('id')}`;
  return null;
})();

(() => {
  const backBtn = document.getElementById('chat-back-btn');
  if (!backBtn) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('person')) {
    backBtn.href = '/roommate_matches.html';
  } else {
    backBtn.href = '/matches.html';
  }
})();

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
  if (typeof text === 'string' && text.startsWith('📅 ')) {
    content.classList.add('meeting');
  }
  content.textContent = text;
  wrapper.appendChild(content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

const isNumericId = (v) => /^\d+$/.test(String(v ?? ''));
const useSocketChat = ctx.isP2P && window.io && isNumericId(ctx.propertyId);

function getPersona() {
  const myRole = getRole();
  const mySubrole = getSubrole();
  if (myRole === 'landlord') return 'tenant';
  if (myRole === 'renter') return 'landlord';
  if (myRole === 'roommate') return mySubrole === 'host' ? 'roommate_seeker' : 'roommate_host';
  return 'landlord';
}

function appendTyping() {
  const wrapper = document.createElement('div');
  wrapper.className = 'message ai typing';
  const content = document.createElement('div');
  content.className = 'message-content';
  content.textContent = '...מקליד/ה';
  wrapper.appendChild(content);
  messages.appendChild(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}

let dispatchUserMessage = (_text) => {};

if (useSocketChat) {
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

  dispatchUserMessage = (text) => {
    appendMessage(text, 'user');
    socket.emit('send_message', {
      token: getToken(),
      property_id: ctx.propertyId,
      renter_id: ctx.renterId,
      content: text
    });
  };
} else {
  const stored = chatId ? getChatMessages(chatId) : [];
  const conversationHistory = stored.map((m) => ({
    role: m.role === 'user' ? 'user' : 'other',
    content: m.content,
  }));

  function persistMessage(role, content) {
    if (!chatId) return;
    addChatMessage(chatId, { role, content });
  }

  async function fetchAIReply() {
    const typingEl = appendTyping();
    try {
      const res = await fetch(`${API_BASE}/api/chat/roleplay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          history: conversationHistory.slice(-15),
          property: ctx.location || {},
          persona: getPersona(),
          other_name: (ctx.title || '').split(',')[0].trim()
        })
      });
      typingEl.remove();
      if (res.ok) {
        const data = await res.json();
        const reply = (data && data.reply) || 'אהלן! איך אפשר לעזור?';
        appendMessage(reply, 'other');
        conversationHistory.push({ role: 'other', content: reply });
        persistMessage('other', reply);
        if (document.hidden) {
          notify(`הודעה חדשה מ${(ctx.title || '').split(',')[0].trim() || 'הצד השני'}`, {
            body: reply,
            tag: `chat-${chatId || 'demo'}`,
            onclick: () => window.focus(),
          });
        }
      } else {
        appendMessage('סליחה, יש לי בעיה כרגע. נסי שוב בעוד רגע.', 'other');
      }
    } catch (e) {
      typingEl.remove();
      console.error(e);
      appendMessage('סליחה, יש בעיית קישור. נסי שוב.', 'other');
    }
  }

  messages.innerHTML = '';
  if (conversationHistory.length) {
    conversationHistory.forEach((m) => appendMessage(m.content, m.role === 'user' ? 'user' : 'other'));
  } else {
    fetchAIReply();
  }

  dispatchUserMessage = (text) => {
    appendMessage(text, 'user');
    conversationHistory.push({ role: 'user', content: text });
    persistMessage('user', text);
    fetchAIReply();
  };
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!value) return;
  input.value = '';
  dispatchUserMessage(value);
});

if (ctx.isP2P) {
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

  const btnScheduleMeeting = document.getElementById('btn-schedule-meeting');
  const scheduleModal = document.getElementById('schedule-modal');
  const closeScheduleModal = document.getElementById('close-schedule-modal');
  const cancelScheduleBtn = document.getElementById('cancel-schedule');
  const confirmScheduleBtn = document.getElementById('confirm-schedule');
  const scheduleDate = document.getElementById('schedule-date');
  const scheduleTime = document.getElementById('schedule-time');
  const scheduleNotes = document.getElementById('schedule-notes');
  const quickButtons = scheduleModal.querySelectorAll('.schedule-quick button');

  btnScheduleMeeting.style.display = 'inline-flex';

  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateInputValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function setQuickShift(days) {
    const target = new Date();
    target.setDate(target.getDate() + days);
    scheduleDate.value = toDateInputValue(target);
    quickButtons.forEach((b) => b.classList.toggle('active', Number(b.dataset.shift) === days));
  }
  function clearQuickActive() {
    quickButtons.forEach((b) => b.classList.remove('active'));
  }

  function openScheduleModal() {
    const today = new Date();
    scheduleDate.min = toDateInputValue(today);
    if (!scheduleDate.value) setQuickShift(1);
    if (!scheduleTime.value) scheduleTime.value = '18:00';
    scheduleNotes.value = '';
    scheduleModal.style.display = 'flex';
  }
  function closeSchedule() {
    scheduleModal.style.display = 'none';
  }

  btnScheduleMeeting.addEventListener('click', openScheduleModal);
  closeScheduleModal.addEventListener('click', closeSchedule);
  cancelScheduleBtn.addEventListener('click', closeSchedule);
  scheduleModal.addEventListener('click', (event) => {
    if (event.target === scheduleModal) closeSchedule();
  });
  quickButtons.forEach((btn) => {
    btn.addEventListener('click', () => setQuickShift(Number(btn.dataset.shift)));
  });
  scheduleDate.addEventListener('input', clearQuickActive);

  confirmScheduleBtn.addEventListener('click', () => {
    if (!scheduleDate.value || !scheduleTime.value) {
      alert('נא לבחור תאריך ושעה');
      return;
    }
    const [y, m, d] = scheduleDate.value.split('-').map(Number);
    const [hh, mm] = scheduleTime.value.split(':').map(Number);
    const dt = new Date(y, m - 1, d, hh, mm);
    const dayLabel = dt.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeLabel = `${pad(hh)}:${pad(mm)}`;
    const notes = scheduleNotes.value.trim();
    const note = notes ? ` — ${notes}` : '';
    const text = `📅 אני מציע/ה להיפגש לצפייה בנכס ב${dayLabel} בשעה ${timeLabel}${note}`;
    closeSchedule();
    dispatchUserMessage(text);
  });
}
