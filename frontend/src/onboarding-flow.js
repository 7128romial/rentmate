// State machine for the onboarding AI Agent. Each step is keyed by id;
// "next" can be a string (next step id) or a function (for branching).
//
// option shape:
//   { label, value?, next?, set? } — value defaults to label, set merges into ctx
// step shape:
//   { ai, options?, save?, next?, freeText? (true|false default true), final? }

const ROLE_PICKER_OPTIONS = [
  { label: '🏡 מחפש/ת דירה', set: { role: 'renter' }, next: 'renter_city' },
  { label: '🤝 מחפש/ת שותף לחפש איתי דירה', set: { role: 'roommate', subrole: 'seeker' }, next: 'seeker_city' },
  { label: '🛏 יש לי דירה ומחפש/ת שותף', set: { role: 'roommate', subrole: 'host' }, next: 'host_address' },
  { label: '🔑 רוצה להשכיר דירה', set: { role: 'landlord' }, next: 'landlord_name' },
];

export const FLOW = {
  _start: {
    ai: 'היי! אני RentMate AI, נעים מאוד 👋\nספר/י לי קצת על עצמך — מה הביא אותך אלינו היום?',
    options: ROLE_PICKER_OPTIONS,
    freeText: false,
  },

  // ----- Renter branch -----
  renter_city: {
    ai: 'אחלה! באיזו עיר היית רוצה לגור?',
    options: [
      { label: 'תל אביב' },
      { label: 'ירושלים' },
      { label: 'חיפה' },
      { label: 'באר שבע' },
      { label: 'הרצליה' },
    ],
    save: ['profile', 'city'],
    next: 'renter_budget',
  },
  renter_budget: {
    ai: 'מה התקציב החודשי שלך לדירה?',
    options: [
      { label: 'עד ₪3500', value: 3500 },
      { label: '₪3500-5000', value: 5000 },
      { label: '₪5000-7000', value: 7000 },
      { label: '₪7000+', value: 8500 },
    ],
    save: ['profile', 'budget'],
    next: 'renter_type',
  },
  renter_type: {
    ai: 'איך את/ה מתכוון/ת לגור?',
    options: [
      { label: 'לבד' },
      { label: 'עם בן/בת זוג' },
      { label: 'עם שותפים' },
      { label: 'משפחה' },
    ],
    save: ['profile', 'type'],
    next: 'renter_extras',
  },
  renter_extras: {
    ai: 'יש משהו שחשוב לך שיהיה בדירה?',
    options: [
      { label: 'מרפסת' },
      { label: 'שקט' },
      { label: 'קרוב לתחבורה' },
      { label: 'מתאים לחיות' },
      { label: 'דלג' },
    ],
    save: ['profile', 'extras'],
    next: '_done_renter',
  },
  _done_renter: {
    ai: 'מצוין, יש לי מספיק כדי להתחיל ✨ בונה לך פרופיל ומעביר אותך לדירות...',
    final: { redirect: '/swipe.html' },
  },

  // ----- Roommate seeker branch -----
  seeker_city: {
    ai: 'איזו עיר אתם מתכננים? (אפשר גם שכונה אם יש לך בראש)',
    options: [
      { label: 'תל אביב מרכז' },
      { label: 'תל אביב צפון' },
      { label: 'יפו' },
      { label: 'ירושלים' },
      { label: 'חיפה' },
    ],
    save: ['profile', 'city'],
    next: 'seeker_budget',
  },
  seeker_budget: {
    ai: 'מה התקציב שלך לחדר בדירת שותפים?',
    options: [
      { label: 'עד ₪2000', value: 2000 },
      { label: '₪2000-2800', value: 2500 },
      { label: '₪2800-3500', value: 3200 },
      { label: '₪3500+', value: 4000 },
    ],
    save: ['profile', 'budget'],
    next: 'seeker_movein',
  },
  seeker_movein: {
    ai: 'מתי אתם רוצים לעבור?',
    options: [
      { label: 'מיידית' },
      { label: 'בחודש הקרוב' },
      { label: 'בעוד 1-2 חודשים' },
      { label: 'גמיש' },
    ],
    save: ['profile', 'moveIn'],
    next: 'seeker_lifestyle',
  },
  seeker_lifestyle: {
    ai: 'איך תתאר/י את אורח החיים שלך? (אפשר לבחור או להקליד)',
    options: [
      { label: 'שקט ומסודר' },
      { label: 'חברתי, אוהב/ת אורחים' },
      { label: 'עובד/ת מהבית' },
      { label: 'יוצא/ת הרבה' },
    ],
    save: ['profile', 'extras'],
    next: '_done_seeker',
  },
  _done_seeker: {
    ai: 'יופי! בונה את הפרופיל שלך ומעביר אותך לחיפוש שותפים 🤝',
    final: { redirect: '/roommate_seeker.html' },
  },

  // ----- Roommate host branch -----
  host_address: {
    ai: 'מעולה! איפה הדירה שלך? (עיר/שכונה)',
    options: [
      { label: 'תל אביב מרכז' },
      { label: 'פלורנטין' },
      { label: 'יפו' },
      { label: 'נווה צדק' },
    ],
    save: ['listing', 'address'],
    next: 'host_price',
  },
  host_price: {
    ai: 'מה המחיר החודשי שאת/ה מבקש/ת על החדר?',
    options: [
      { label: 'עד ₪2000', value: 2000 },
      { label: '₪2000-2500', value: 2300 },
      { label: '₪2500-3000', value: 2800 },
      { label: '₪3000+', value: 3300 },
    ],
    save: ['listing', 'roomPrice'],
    next: 'host_lifestyle',
  },
  host_lifestyle: {
    ai: 'באיזה שותף את/ה מקווה לפגוש?',
    options: [
      { label: 'שקט ומסודר' },
      { label: 'חברתי' },
      { label: 'מקבל/ת חיות' },
      { label: 'גמיש/ה' },
    ],
    save: ['listing', 'preferredLifestyle'],
    next: 'host_about',
  },
  host_about: {
    ai: 'בקצרה — איך היית מתאר/ת את עצמך כשותף/ה?',
    options: [
      { label: 'עובד/ת הרבה, ביתי/ת בערב' },
      { label: 'יוצא/ת הרבה' },
      { label: 'עובד/ת מהבית' },
    ],
    save: ['listing', 'aboutMe'],
    next: '_done_host',
  },
  _done_host: {
    ai: 'מצוין! פותח/ת לך את ניהול הליסטינג 🛏',
    final: { redirect: '/roommate_host.html' },
  },

  // ----- Landlord branch -----
  landlord_name: {
    ai: 'איך לקרוא לך?',
    options: [],
    save: ['profile', 'name'],
    next: 'landlord_count',
  },
  landlord_count: {
    ai: 'כמה דירות יש לך להשכרה?',
    options: [
      { label: 'רק אחת' },
      { label: '2-3' },
      { label: '4-10' },
      { label: '10+' },
    ],
    save: ['profile', 'numProperties'],
    next: 'landlord_area',
  },
  landlord_area: {
    ai: 'באילו אזורים נמצאות הדירות?',
    options: [
      { label: 'תל אביב' },
      { label: 'מרכז' },
      { label: 'ירושלים' },
      { label: 'צפון' },
      { label: 'דרום' },
    ],
    save: ['profile', 'city'],
    next: 'landlord_price',
  },
  landlord_price: {
    ai: 'מה הטווח המחירים החודשי שלך?',
    options: [
      { label: '₪3000-5000' },
      { label: '₪5000-7000' },
      { label: '₪7000+' },
    ],
    save: ['profile', 'priceRange'],
    next: 'landlord_offer_property',
  },
  landlord_offer_property: {
    ai: 'רוצה שנוסיף עכשיו את הדירה הראשונה שלך? אפשר גם בהמשך מהדשבורד.',
    options: [
      { label: 'כן, נוסיף עכשיו', next: 'landlord_prop_title' },
      { label: 'אחר כך', next: '_done_landlord' },
    ],
    freeText: false,
  },
  landlord_prop_title: {
    ai: 'איך תקראו לדירה? (כותרת קצרה)',
    options: [
      { label: 'סטודיו מואר' },
      { label: 'דירת 2 חדרים' },
      { label: 'דירת 3 חדרים' },
    ],
    save: ['firstProperty', 'title'],
    next: 'landlord_prop_address',
  },
  landlord_prop_address: {
    ai: 'מה הכתובת? (רחוב, עיר)',
    options: [
      { label: 'רוטשילד, תל אביב' },
      { label: 'דיזנגוף, תל אביב' },
      { label: 'פלורנטין, תל אביב' },
      { label: 'יפו' },
    ],
    save: ['firstProperty', 'address'],
    next: 'landlord_prop_price',
  },
  landlord_prop_price: {
    ai: 'מה המחיר החודשי?',
    options: [
      { label: '₪3500', value: 3500 },
      { label: '₪4500', value: 4500 },
      { label: '₪5500', value: 5500 },
      { label: '₪7000', value: 7000 },
    ],
    save: ['firstProperty', 'price'],
    next: 'landlord_prop_rooms',
  },
  landlord_prop_rooms: {
    ai: 'כמה חדרים?',
    options: [
      { label: '1 (סטודיו)', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: '4+', value: 4 },
    ],
    save: ['firstProperty', 'rooms'],
    next: 'landlord_prop_image',
  },
  landlord_prop_image: {
    ai: 'יש קישור לתמונה? (אפשר לדלג ונבחר תמונה ברירת מחדל)',
    options: [{ label: 'דלג' }],
    save: ['firstProperty', 'image'],
    next: '_done_landlord_with_property',
  },
  _done_landlord: {
    ai: 'מעולה. פותח/ת לך את לוח הניהול 🔑',
    final: { redirect: '/landlord.html' },
  },
  _done_landlord_with_property: {
    ai: 'מצוין! פרסמתי את הדירה ופותח/ת את הדשבורד 🔑',
    final: { redirect: '/landlord.html' },
  },
};
