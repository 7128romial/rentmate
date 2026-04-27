// Self-contained demo data + flow used when VITE_DEMO_MODE=true. No backend required.

export const DEMO_PROPERTIES = [
  {
    id: 'demo-1',
    title: 'סטודיו מואר בפלורנטין',
    price: '₪4,500/חודש',
    image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80',
    matchScore: 98,
    tags: ['שקט', 'משופצת', 'קרוב לרכבת'],
    address: 'פלורנטין, תל אביב',
    lat: 32.0556,
    lng: 34.7708,
  },
  {
    id: 'demo-2',
    title: 'דירת 2 חדרים בלב העיר',
    price: '₪4,850/חודש',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1de2d93688?auto=format&fit=crop&w=600&q=80',
    matchScore: 92,
    tags: ['מרווחת', 'זוגות', 'מרפסת'],
    address: 'דיזנגוף, תל אביב',
    lat: 32.0775,
    lng: 34.7748,
  },
  {
    id: 'demo-3',
    title: 'לופט יוקרתי ליד הים',
    price: '₪5,700/חודש',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80',
    matchScore: 88,
    tags: ['פרימיום', 'מרפסת', 'נוף לים'],
    address: 'הירקון, תל אביב',
    lat: 32.0892,
    lng: 34.7669,
  },
  {
    id: 'demo-4',
    title: 'גן יפה בנווה צדק',
    price: '₪4,200/חודש',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80',
    matchScore: 90,
    tags: ['גינה', 'שקט', 'מתאים לכלב'],
    address: 'נווה צדק, תל אביב',
    lat: 32.0617,
    lng: 34.7619,
  },
];

export function findDemoProperty(id) {
  return DEMO_PROPERTIES.find((p) => String(p.id) === String(id)) || null;
}

// Scripted onboarding chat. Each user message advances the script by one step.
const CHAT_SCRIPT = [
  { ai: 'היי! אני RentMate. בוא נמצא לך את הדירה הבאה. איפה היית רוצה לגור?' },
  { ai: 'מעולה. ומה התקציב החודשי שלך?' },
  { ai: 'כמה אנשים גרים יחד? לבד, זוג או שותפים?' },
  { ai: 'יש לך דרישות מיוחדות? מרפסת, שקט, חיות, חניה...' },
  {
    ai: 'מצוין, יש לי מספיק כדי להתחיל. בונה לך פרופיל אישי...',
    profileComplete: true,
  },
];

let chatStep = 0;

export function resetDemoChat() {
  chatStep = 0;
}

export function nextDemoReply() {
  const step = CHAT_SCRIPT[Math.min(chatStep, CHAT_SCRIPT.length - 1)];
  chatStep += 1;
  return {
    response: step.ai,
    profile_complete: !!step.profileComplete,
  };
}

const SESSION_KEY = 'rentmate_demo_session';

export function fakeSession(phone) {
  return {
    user_id: `demo-${phone || 'guest'}`,
    token: 'demo-token',
  };
}

export function setDemoFlag(phone) {
  try {
    sessionStorage.setItem(SESSION_KEY, phone || '1');
  } catch (e) {
    /* ignore */
  }
}
