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
  {
    id: 'demo-5',
    title: 'דירת 3 חדרים בלב רחביה',
    price: '₪5,200/חודש',
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=600&q=80',
    matchScore: 91,
    tags: ['אבן ירושלמית', 'תקרה גבוהה', 'שקט'],
    address: 'רחביה, ירושלים',
    lat: 31.7770,
    lng: 35.2110,
    rooms: 3,
    area: 78,
    floor: 1,
    totalFloors: 3,
    available: '15 ביוני',
    deposit: '₪10,400',
    description:
      'דירת 3 חדרים אותנטית בבניין אבן ירושלמית קלאסי ברחביה. תקרה גבוהה, רצפת בלטות מקור, מטבח מחודש, חלונות עץ ענקיים לרחוב שקט. קרוב לגן סאקר ולבן יהודה.',
    amenities: ['חימום מרכזי', 'דוד שמש', 'אינטרנט סיבים', 'מחסן בקומת קרקע', 'מזגן בכל חדר'],
    nearby: ['גן סאקר — 5 דק׳', 'מדרחוב בן יהודה — 12 דק׳', 'שוק מחנה יהודה — 15 דק׳'],
  },
  {
    id: 'demo-6',
    title: 'סטודיו עם נוף לים בכרמל',
    price: '₪3,200/חודש',
    image: 'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=600&q=80',
    matchScore: 87,
    tags: ['נוף לים', 'מרפסת', 'מיקום מעולה'],
    address: 'שדרות הנשיא, הדר הכרמל, חיפה',
    lat: 32.8093,
    lng: 34.9890,
    rooms: 1.5,
    area: 42,
    floor: 6,
    totalFloors: 8,
    available: 'מיידית',
    deposit: '₪6,400',
    description:
      'סטודיו מעוצב בקומה 6 עם נוף פתוח אל מפרץ חיפה. מרפסת קטנה לקפה של בוקר, מטבח אמריקאי, מקלחון זכוכית. הבניין שמור ונקי, מעלית חדשה.',
    amenities: ['נוף לים', 'מעלית', 'מזגן מיני-מרכזי', 'דוד שמש', 'אינטרנט סיבים'],
    nearby: ['גן האם — 4 דק׳', 'תחנת רכבל — 7 דק׳', 'חוף בת גלים — 9 דק׳ ברכב'],
  },
  {
    id: 'demo-7',
    title: 'דירת 2 חדרים ליד הבורסה',
    price: '₪4,500/חודש',
    image: 'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?auto=format&fit=crop&w=600&q=80',
    matchScore: 89,
    tags: ['קרוב לרכבת', 'חניה', 'מודרני'],
    address: "ז'בוטינסקי, רמת גן",
    lat: 32.0822,
    lng: 34.8141,
    rooms: 2,
    area: 52,
    floor: 4,
    totalFloors: 9,
    available: '1 ביולי',
    deposit: '₪9,000',
    description:
      'דירת 2 חדרים מודרנית במרחק הליכה מהבורסה ומתחנת הרכבת בני ברק. עיצוב נקי, מטבח שיש, מרפסת קטנה לכיוון מזרח. חניה במחיר נוסף.',
    amenities: ['מעלית', 'ממ"ד', 'דוד שמש', 'אינטרנט סיבים', 'אפשרות לחניה'],
    nearby: ['בורסת היהלומים — 4 דק׳', 'תחנת רכבת בני ברק — 8 דק׳', 'פארק לאומי — 7 דק׳'],
  },
  {
    id: 'demo-8',
    title: 'דירת 3 חדרים מרווחת בגני תקווה',
    price: '₪4,800/חודש',
    image: 'https://images.unsplash.com/photo-1571508601891-ca5e7a713859?auto=format&fit=crop&w=600&q=80',
    matchScore: 93,
    tags: ['משופצת', 'מרפסת גדולה', 'חניה מקורה'],
    address: 'בן צבי, גני תקווה',
    lat: 32.0653,
    lng: 34.8742,
    rooms: 3,
    area: 82,
    floor: 2,
    totalFloors: 4,
    available: '15 ביולי',
    deposit: '₪9,600',
    description:
      'דירה משופצת לאחרונה ברחוב שקט בגני תקווה. סלון מרווח, מטבח חדש פתוח, מרפסת שמש של 12 מ״ר עם נוף ירוק. חניה מקורה צמודה.',
    amenities: ['חניה מקורה', 'מרפסת שמש', 'ממ"ד', 'מחסן', 'מזגן מיני-מרכזי'],
    nearby: ['פארק כפר גנים — 6 דק׳', "סינמה סיטי גלילות — 10 דק׳ ברכב", 'קניון אילון — 12 דק׳'],
  },
  {
    id: 'demo-9',
    title: 'מיני-פנטהאוז בהרצליה פיתוח',
    price: '₪6,200/חודש',
    image: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=600&q=80',
    matchScore: 86,
    tags: ['פנטהאוז', 'נוף לים', 'בריכה בבניין'],
    address: 'מדינת היהודים, הרצליה פיתוח',
    lat: 32.1640,
    lng: 34.8081,
    rooms: 2.5,
    area: 75,
    floor: 11,
    totalFloors: 12,
    available: '1 באוגוסט',
    deposit: '₪12,400',
    description:
      'מיני-פנטהאוז בקומה גבוהה עם מרפסת ענקית של 28 מ״ר ונוף פתוח אל הים. הבניין כולל בריכה, חדר כושר ולובי מאויש. דירה מאובזרת, ריהוט חלקי.',
    amenities: ['מרפסת 28 מ"ר', 'בריכה בבניין', 'חדר כושר', 'חניה מקורה', 'לובי 24/7'],
    nearby: ['חוף הנכים — 7 דק׳', 'מתחם 7 כוכבים — 5 דק׳', 'תחנת רכבת הרצליה — 12 דק׳'],
  },
  {
    id: 'demo-10',
    title: 'דירה זוגית במרכז באר שבע',
    price: '₪2,400/חודש',
    image: 'https://images.unsplash.com/photo-1564540583246-934409427776?auto=format&fit=crop&w=600&q=80',
    matchScore: 84,
    tags: ['מתאים לסטודנטים', 'קרוב לאוניברסיטה', 'מחיר טוב'],
    address: 'רגר, מרכז העיר, באר שבע',
    lat: 31.2589,
    lng: 34.7949,
    rooms: 2,
    area: 46,
    floor: 3,
    totalFloors: 4,
    available: '1 בספטמבר',
    deposit: '₪4,800',
    description:
      'דירה אינטימית במרכז באר שבע, 7 דקות הליכה מאוניברסיטת בן גוריון. מטבח קטן אך מסודר, מקלחת חדשה, מרפסת לכיוון רחוב פנימי שקט.',
    amenities: ['מזגן בכל חדר', 'דוד שמש', 'אינטרנט סיבים', 'מקרר ומכונת כביסה'],
    nearby: ['אוניברסיטת בן גוריון — 7 דק׳ הליכה', "גרנד קניון ב\"ש — 10 דק׳", 'תחנת רכבת מרכז — 9 דק׳'],
  },
];

export function findDemoProperty(id) {
  return DEMO_PROPERTIES.find((p) => String(p.id) === String(id)) || null;
}

// Mock renter profiles used by the landlord side. In demo mode each property
// is shown to have a subset of these renters interested in it.
export const DEMO_RENTERS = [
  {
    id: 'renter-1',
    name: 'דנה לוי',
    age: 28,
    occupation: 'מעצבת UI',
    budget: 4500,
    movingFrom: 'באר שבע',
    bio: 'מחפשת מקום שקט, אוהבת לבשל ולעבוד מהבית.',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    matchScore: 96,
  },
  {
    id: 'renter-2',
    name: 'יונתן כהן',
    age: 31,
    occupation: 'מהנדס תוכנה',
    budget: 5200,
    movingFrom: 'חיפה',
    bio: 'מתעבר עקב עבודה חדשה. מסודר, ללא חיות.',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    matchScore: 92,
  },
  {
    id: 'renter-3',
    name: 'מאיה ושירן',
    age: 26,
    occupation: 'סטודנטיות',
    budget: 4800,
    movingFrom: 'תל אביב',
    bio: 'זוג שותפות שמחפשות דירה בקרבת התחבורה הציבורית.',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=80',
    matchScore: 90,
  },
  {
    id: 'renter-4',
    name: 'אסף ברק',
    age: 34,
    occupation: 'שף',
    budget: 5500,
    movingFrom: 'ירושלים',
    bio: 'אוהב לבשל לאורחים, מחפש מטבח גדול ושכנים סלחניים.',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
    matchScore: 88,
  },
  {
    id: 'renter-5',
    name: 'נועה אברהם',
    age: 29,
    occupation: 'יועצת ארגונית',
    budget: 4700,
    movingFrom: 'רעננה',
    bio: 'בעלת כלב קטן ושקט (2 ק״ג). עובדת רוב הזמן מחוץ לבית.',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    matchScore: 85,
  },
  {
    id: 'renter-6',
    name: 'עומר ניר',
    age: 27,
    occupation: 'מורה לאנגלית',
    budget: 4200,
    movingFrom: 'הרצליה',
    bio: 'נכנס לעבודה חדשה בתל אביב, חיפוש שקט וקרוב לתחבורה.',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&q=80',
    matchScore: 83,
  },
];

// Deterministic mapping of which renters showed interest in which property.
// Keeps the demo stable across reloads instead of randomising each visit.
const PROPERTY_INTERESTS = {
  'demo-1': ['renter-1', 'renter-2', 'renter-6'],
  'demo-2': ['renter-3', 'renter-2'],
  'demo-3': ['renter-4', 'renter-2', 'renter-5'],
  'demo-4': ['renter-5', 'renter-1', 'renter-3', 'renter-6'],
  'demo-5': ['renter-2', 'renter-4'],
  'demo-6': ['renter-3', 'renter-6'],
  'demo-7': ['renter-1', 'renter-5', 'renter-2'],
  'demo-8': ['renter-6', 'renter-3', 'renter-4'],
  'demo-9': ['renter-1', 'renter-2'],
  'demo-10': ['renter-5', 'renter-4', 'renter-6'],
};

export function getInterestedRenterIds(propertyId) {
  return PROPERTY_INTERESTS[String(propertyId)] || [];
}

export function findDemoRenter(id) {
  return DEMO_RENTERS.find((r) => String(r.id) === String(id)) || null;
}

// --- Roommate flows ---

// (A) Hosts: someone with an apartment + a spare room, looking for a roommate.
// Each entry mixes property fields (so the cards reuse the apartment renderer)
// with host fields displayed under "השותף שלך".
export const DEMO_SHARED_LISTINGS = [
  {
    id: 'shared-1',
    title: 'חדר בדירת 3 חד׳ ברוטשילד',
    price: '₪2,400/חודש',
    image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
    matchScore: 94,
    tags: ['דירה משותפת', 'מרפסת', 'מרוהט'],
    address: 'רוטשילד, תל אביב',
    lat: 32.0635,
    lng: 34.7745,
    rooms: 3,
    area: 75,
    floor: 4,
    totalFloors: 5,
    available: '15 ביוני',
    deposit: '₪4,800',
    description:
      'חדר פנוי בדירת 3 חדרים ברוטשילד. החדר מרוהט עם מיטה זוגית, ארון וכוננית. הסלון משותף, מטבח גדול, מרפסת לכיוון הבולווארד.',
    amenities: ['מזגן בחדר', 'מיטה זוגית', 'מרפסת משותפת', 'מכונת כביסה', 'אינטרנט'],
    nearby: ['קפה אספרסו בר — 2 דק׳', 'תחנת רכבת השלום — 6 דק׳'],
    kind: 'shared',
    host: {
      name: 'תמר',
      age: 29,
      occupation: 'מעצבת גרפית',
      lifestyle: 'שקט יחסית, אוהבת בישול ביתי, ללא חיות',
      photo: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=80',
    },
  },
  {
    id: 'shared-2',
    title: 'חדר בדירת גג ביפו',
    price: '₪2,800/חודש',
    image: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=600&q=80',
    matchScore: 91,
    tags: ['דירה משותפת', 'גג פתוח', 'נוף'],
    address: 'יפת, יפו',
    lat: 32.0529,
    lng: 34.7521,
    rooms: 3,
    area: 88,
    floor: 3,
    totalFloors: 3,
    available: 'מיידית',
    deposit: '₪5,600',
    description:
      'חדר פרטי גדול בדירת גג ביפו, גישה לגג פתוח עם נוף ים. השותפה היא צלמת שעובדת בעיקר בחו״ל. מתאים למישהו רגוע ועצמאי.',
    amenities: ['גג פתוח', 'מטבח גדול', 'חניה ברחוב', 'קרוב לים'],
    nearby: ['שוק הפשפשים — 4 דק׳', 'חוף יפו — 9 דק׳', 'רחוב יפת — מיד'],
    kind: 'shared',
    host: {
      name: 'נועם',
      age: 34,
      occupation: 'צלם תיירות',
      lifestyle: 'הרבה בחו״ל, חתולה אחת ידידותית',
      photo: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=200&q=80',
    },
  },
  {
    id: 'shared-3',
    title: 'חדר בדירת שותפים בנחלת בנימין',
    price: '₪2,200/חודש',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80',
    matchScore: 88,
    tags: ['דירה משותפת', 'מרכזי', 'תקציב נוח'],
    address: 'נחלת בנימין, תל אביב',
    lat: 32.0688,
    lng: 34.7741,
    rooms: 4,
    area: 95,
    floor: 2,
    totalFloors: 4,
    available: '1 ביולי',
    deposit: '₪4,400',
    description:
      'דירת שותפים מתפקדת היטב, 4 חדרים. החדר הפנוי גדול, חלון לרחוב צדדי. אווירה ידידותית, ארוחת ערב משותפת פעם בשבוע.',
    amenities: ['סלון מרוהט', 'מטבח גדול', 'מרפסת שירות', 'אינטרנט סיבים'],
    nearby: ['שוק הכרמל — 3 דק׳', 'דיזנגוף — 5 דק׳', 'אלנבי — מיד'],
    kind: 'shared',
    host: {
      name: 'אריאל ויואב',
      age: 27,
      occupation: 'מורה ופרילנס',
      lifestyle: 'חברותיים, אוהבים אורחים, ללא חיות',
      photo: 'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=200&q=80',
    },
  },
];

export function findSharedListing(id) {
  return DEMO_SHARED_LISTINGS.find((s) => String(s.id) === String(id)) || null;
}

// The "current user as host" — the listing that they own when logging in as
// a roommate host. Demo only.
export const DEMO_MY_LISTING = {
  ...DEMO_SHARED_LISTINGS[0],
  id: 'my-listing',
  title: 'החדר שלי בדיזנגוף',
  address: 'דיזנגוף, תל אביב',
  lat: 32.0775,
  lng: 34.7748,
  host: {
    name: 'אני',
    age: null,
    occupation: '',
    lifestyle: '',
    photo: '',
  },
};

// (B) People without a place, looking for a roommate to find one with.
export const DEMO_ROOMMATE_PEOPLE = [
  {
    id: 'person-1',
    name: 'שירה אבן',
    age: 26,
    occupation: 'סטודנטית לרפואה',
    budget: 2500,
    targetArea: 'תל אביב מרכז',
    moveIn: '1 ביולי',
    bio: 'אוהבת לבשל בערב, לומדת באוניברסיטה. מחפשת שותפה רגועה.',
    lifestyle: 'בלילה בבית, ללא חיות, לא מעשנת',
    photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
    matchScore: 96,
    tags: ['שקט', 'ללא עישון', 'בית בערב'],
  },
  {
    id: 'person-2',
    name: 'רני מזרחי',
    age: 28,
    occupation: 'מהנדס תוכנה',
    budget: 3200,
    targetArea: 'פלורנטין/יפו',
    moveIn: '15 ביוני',
    bio: 'עובד מהבית 3 ימים בשבוע, אוהב מוזיקה ושכנים סבלניים.',
    lifestyle: 'בעל גיטרה אקוסטית, לא מעשן, מסודר',
    photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    matchScore: 92,
    tags: ['עובד מהבית', 'מסודר', 'מוזיקה'],
  },
  {
    id: 'person-3',
    name: 'עדי כרמלי',
    age: 30,
    occupation: 'יועצת תקשורת',
    budget: 2800,
    targetArea: 'נווה צדק/רוטשילד',
    moveIn: 'מיידית',
    bio: 'נוסעת לעבודה מוקדם, חוזרת מאוחר. מחפשת בית שקט.',
    lifestyle: 'מוקדם בבוקר, ספורט, ללא חיות',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    matchScore: 90,
    tags: ['בוקר מוקדם', 'ספורט', 'שקט'],
  },
  {
    id: 'person-4',
    name: 'דניאל ליברמן',
    age: 33,
    occupation: 'שף',
    budget: 3500,
    targetArea: 'רוטשילד',
    moveIn: '1 ביולי',
    bio: 'אוהב לבשל לאורחים, יוצא בלילה. מחפש שותף שאוהב לאכול.',
    lifestyle: 'מבשל הרבה, חוזר מאוחר, אוכל גורמה',
    photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=400&q=80',
    matchScore: 88,
    tags: ['בישול', 'חוזר מאוחר', 'אוכל'],
  },
  {
    id: 'person-5',
    name: 'מאי גולדמן',
    age: 25,
    occupation: 'מורה ליוגה',
    budget: 2400,
    targetArea: 'שוק הפשפשים/יפו',
    moveIn: '15 ביולי',
    bio: 'אוהבת בית מסודר וצמחים. מחפשת מישהו רגוע.',
    lifestyle: 'יוגה בבוקר, צמחונית, אוהבת חיות',
    photo: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    matchScore: 87,
    tags: ['צמחונית', 'יוגה', 'אוהבת חיות'],
  },
  {
    id: 'person-6',
    name: 'יואב אורן',
    age: 29,
    occupation: 'עורך וידאו',
    budget: 3000,
    targetArea: 'דיזנגוף/בן יהודה',
    moveIn: '1 ביוני',
    bio: 'עובד בלילה, ישן בבוקר. מחפש שותף שלא יפריע ולא יפריעו לו.',
    lifestyle: 'לילי, מצנן, מסודר',
    photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    matchScore: 85,
    tags: ['לילי', 'עצמאי', 'שקט'],
  },
];

export function findRoommatePerson(id) {
  return DEMO_ROOMMATE_PEOPLE.find((p) => String(p.id) === String(id)) || null;
}

// People who said they'd love to move into the demo user's apartment.
const MY_LISTING_INTERESTS = ['person-1', 'person-3', 'person-5'];

export function getMyListingInterestedPeople() {
  return MY_LISTING_INTERESTS.map(findRoommatePerson).filter(Boolean);
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
