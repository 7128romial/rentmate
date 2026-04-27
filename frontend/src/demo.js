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
    rooms: 1.5,
    area: 38,
    floor: 2,
    totalFloors: 4,
    available: '1 ביוני',
    deposit: '₪9,000',
    description:
      'סטודיו מקסים ומשופץ בלב פלורנטין הפועם. תקרה גבוהה, חלונות גדולים לכיוון רחוב שקט, מטבח חדש עם כל הכלים. קרוב מאוד לתחנת הרכבת ולקפה דונה. בניין שמור עם מעלית.',
    amenities: ['מזגן', 'דוד שמש', 'אינטרנט סיבים', 'תריסי חשמל', 'מקלחון זכוכית'],
    nearby: ['מאפיית לחמים — 2 דק׳ הליכה', 'תחנת רכבת השלום — 7 דק׳', 'גן לוינסקי — 5 דק׳'],
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
    rooms: 2,
    area: 55,
    floor: 3,
    totalFloors: 5,
    available: '15 ביוני',
    deposit: '₪9,700',
    description:
      'דירת 2 חדרים מרווחת ומוארת ברחוב דיזנגוף, קומה 3. סלון פתוח, מרפסת שמש לכיוון מערב, חדר שינה גדול עם ארון קיר ענק. הבניין כולל לובי, מעלית ושומר.',
    amenities: ['מרפסת שמש', 'מעלית', 'חניה משותפת', 'ממ"ד', 'מזגן מיני-מרכזי'],
    nearby: ['כיכר דיזנגוף — 4 דק׳', 'שדרות בן גוריון — 6 דק׳', 'שוק הכרמל — 12 דק׳'],
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
    rooms: 2.5,
    area: 72,
    floor: 8,
    totalFloors: 12,
    available: 'מיידית',
    deposit: '₪11,400',
    description:
      'לופט יוקרתי בקומה גבוהה עם נוף פתוח אל הים. עיצוב מודרני, רצפת אלון, מטבח שף עם אי. מרפסת רחבה לאירוח. הבניין כולל בריכה, חדר כושר ולובי 24/7.',
    amenities: ['נוף לים', 'בריכה בבניין', 'חדר כושר', 'מרפסת 12 מ״ר', 'חניה מקורה'],
    nearby: ['חוף הילטון — 3 דק׳ הליכה', 'נמל תל אביב — 8 דק׳', 'פארק הירקון — 10 דק׳'],
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
    rooms: 2,
    area: 48,
    floor: 0,
    totalFloors: 2,
    available: '1 ביולי',
    deposit: '₪8,400',
    description:
      'דירת גן בסמטה שקטה בנווה צדק עם גינה פרטית של 18 מ״ר. מטבח כפרי, רצפת בטון מוחלקת, מתאים לכלב או חתול. הבעלים גרים בקומה למעלה ומאוד נחמדים.',
    amenities: ['גינה פרטית', 'מתאים לחיות', 'דוד שמש', 'מחסן חיצוני', 'מזגן עילי'],
    nearby: ['רחוב שבזי — 3 דק׳', 'תחנת רכבת ההגנה — 9 דק׳', 'חוף בנים — 12 דק׳'],
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
