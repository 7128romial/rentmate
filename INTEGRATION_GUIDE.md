# INTEGRATION GUIDE — RentMate

מדריך מלא להקמת שירותי הצד השלישי שהפרויקט משתמש בהם. הקוד של RentMate יעבוד
מקצה לקצה גם בלי שחלק מהשירותים יוגדרו (המערכת תיפול חזרה להתנהגות dev
קריאה). לפרודקשן — חובה להשלים את כולם.

---

## 1. Twilio (SMS OTP)

**מה זה עושה:** שולח קודים של 6 ספרות ל-SMS לאימות משתמשים.

**עלות:** חינמי לתקופת ניסיון (15$ זיכוי), אח״כ ~$0.05 לאימות.

**הקמה:**
1. https://www.twilio.com/try-twilio — נרשמים
2. בקונסול: **Verify** → **Services** → **Create New**
3. Friendly name: `RentMate`
4. שמרו:
   - `Account SID` (מופיע בדשבורד)
   - `Auth Token` (מופיע בדשבורד)
   - `Service SID` של ה-Verify Service שיצרתם (מתחיל ב-`VA...`)
5. הוסיפו ב-`.env`:
   ```
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_VERIFY_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

**בדיקה:** `python -c "from app import create_app; ..."` או פשוט התחברו דרך האתר.

**Dev fallback:** אם משתנים לא מוגדרים, הקוד מקבל את `000000` ומודפס ל-log.

---

## 2. OpenAI (סוכן בינה מלאכותית)

**מה זה עושה:** מראיין משתמשים בעברית לבניית פרופיל העדפות.

**עלות:** gpt-4o-mini עולה ~$0.15 / מיליון tokens input, ~$0.60 / מיליון output.
ראיון ממוצע של 10 הודעות = ~4,000 tokens = פחות מסנט.

**הקמה:**
1. https://platform.openai.com/ — נרשמים
2. **Billing** → **Add payment method** (חובה — ה-free tier לא כולל gpt-4o-mini)
3. **API keys** → **Create new secret key**
4. העתיקו את המפתח (מופיע פעם אחת בלבד!)
5. הוסיפו ב-`.env`:
   ```
   OPENAI_API_KEY=sk-...
   OPENAI_MODEL=gpt-4o-mini
   ```

**Dev fallback:** אם לא מוגדר — נכנס לתרחיש סקריפט של 5 שאלות שמייצר פרופיל דמו.

---

## 3. Google Maps (geocoding + autocomplete)

**מה זה עושה:** השלמה אוטומטית של כתובות באשף פרסום הדירה + המרה לקואורדינטות.

**עלות:** החבילה החודשית החינמית כוללת $200 קרדיט — יספיק לאלפי חיפושים.

**הקמה:**
1. https://console.cloud.google.com/ — פתחו פרויקט חדש
2. **APIs & Services** → **Enable APIs** → אפעילו:
   - Maps JavaScript API
   - Places API
   - Geocoding API
3. **Credentials** → **Create credentials** → **API key**
4. **חשוב:** **Restrict key** → Application restrictions: **HTTP referrers** →
   הוסיפו את הדומיינים שלכם (למשל `*.yourdomain.com/*` + `localhost:5000/*`)
5. API restrictions: הגבילו רק ל-3 ה-APIs למעלה
6. הוסיפו ב-`.env`:
   ```
   GOOGLE_MAPS_API_KEY=AIza...
   ```

**Dev fallback:** אם לא מוגדר — שדה כתובת רגיל בלי autocomplete + אין מפה בתצוגה.

---

## 4. Firebase (Firestore chat + FCM push)

**מה זה עושה:**
- **Firestore** — מאחסן הודעות בזמן אמת לסנכרון מיידי בין מכשירים.
- **Cloud Messaging** — שולח התראות push לדפדפן/מובייל.

**עלות:** Firestore free tier = 50k read/day, 20k write/day — מכסה אלפי משתמשים.
FCM חינמי ללא הגבלה.

**הקמה:**
1. https://console.firebase.google.com/ → **Add project**
2. שם: `rentmate` (או מה שתרצו), Google Analytics: אופציונלי
3. **Build → Firestore Database** → **Create** → התחילו ב-**production mode**
4. כתבו את הכללים הבאים ב-Firestore Rules:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /conversations/{conversationId} {
         // רק שרת יכול לכתוב; קריאה פתוחה למשתמשים מורשים דרך Firebase Auth
         // להעמקת אבטחה — שילוב Firebase Auth בצד הקליינט
         allow read: if true;
         allow write: if false;
         match /messages/{messageId} {
           allow read: if true;
           allow write: if false;
         }
       }
     }
   }
   ```

5. **Project Settings → Service accounts → Generate new private key**
   שמרו את ה-JSON כ-`firebase-credentials.json` בתיקיית הפרויקט.
   **חשוב:** הקובץ **לא** נכנס ל-git.

6. **Project Settings → General → Your apps → Web (</> icon)**:
   רשמו את האפליקציה וקחו את פרטי ה-`firebaseConfig` (apiKey, authDomain, projectId, etc.)

7. **Build → Cloud Messaging → Generate key pair** (עבור VAPID — לדחיפה ל-web)

8. הוסיפו ב-`.env`:
   ```
   FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
   FIREBASE_PROJECT_ID=rentmate-xxxxx
   FIREBASE_API_KEY=AIza...
   FIREBASE_AUTH_DOMAIN=rentmate-xxxxx.firebaseapp.com
   FIREBASE_MESSAGING_SENDER_ID=123456789
   FIREBASE_APP_ID=1:123:web:abc
   FIREBASE_VAPID_KEY=BK...
   ```

**Dev fallback:** אם אין Firebase — הצ׳אט עובד דרך polling של 4 שניות, push לא נשלח (רק התראה ב-DB).

---

## 5. Cloudinary (אחסון תמונות)

**מה זה עושה:** מאחסן תמונות של דירות ומשתמשים ב-CDN עולמי.

**עלות:** Free tier = 25GB storage + 25GB bandwidth/month — מספיק למאות משתמשים.

**הקמה:**
1. https://cloudinary.com/ — נרשמים
2. בדשבורד תראו:
   - `Cloud Name`
   - `API Key`
   - `API Secret`
3. הוסיפו ב-`.env`:
   ```
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=1234567890
   CLOUDINARY_API_SECRET=abcdefghij
   ```

**Dev fallback:** תמונות נשמרות מקומית ב-`app/static/uploads/` (קובצי webp עם Pillow).

---

## 6. משתני סביבה בפרודקשן — Checklist

לפני deploy ל-cPanel, ודאו ש:

- [ ] `SECRET_KEY` — מחרוזת אקראית 64+ תווים (`python -c "import secrets; print(secrets.token_urlsafe(64))"`)
- [ ] `FLASK_ENV=production`
- [ ] `DATABASE_URL` — `mysql+pymysql://user:pass@host/db`
- [ ] `APP_BASE_URL` — ה-URL עם `https://`
- [ ] `TWILIO_*` — כל שלושת המפתחות מוגדרים
- [ ] `OPENAI_API_KEY` מוגדר
- [ ] `GOOGLE_MAPS_API_KEY` — מוגבל לדומיין שלכם
- [ ] `FIREBASE_CREDENTIALS_PATH` — קובץ קיים ב-600 perms
- [ ] `FIREBASE_API_KEY` + שאר פרטי הלקוח
- [ ] `CLOUDINARY_*` — שלושת המפתחות
- [ ] אין מפתח שנשאר בקוד המקור או שעלה ל-git

## 7. Rate limits לשים לב אליהם

| שירות | Free tier / חשש |
|------|-----------------|
| Twilio | 15$ קרדיט, אח״כ לפי שימוש. Verify SDK כבר מגביל ב-5 ניסיונות לדקה לטלפון |
| OpenAI | חיוב לפי token; הפוקח הוא Flask-Limiter (30/min/user ב-`/ai/message`) |
| Google Maps | $200/month credit — פחות או יותר 40k autocomplete requests בחינם |
| Firebase | 50k read, 20k write ליום — יספיק לעד ~2,000 משתמשים פעילים |
| Cloudinary | 25GB אחסון; הפרמטרים של Pillow אצלנו שומרים תמונה ~150KB |

---

## 8. איתור תקלות

- **"Twilio send_otp failed: [HTTP 401]"** — Account SID או Auth Token שגויים.
- **"OpenAI quota exceeded"** — הוסיפו credit card / בדקו את הדשבורד.
- **הצ׳אט לא מעדכן בזמן אמת** — בדקו בקונסול הדפדפן ש-`firebase-app.js` נטען
  וש-`FIREBASE_API_KEY` ב-`.env` מופיע ב-HTML (דרך `RM_CONFIG.firebase`).
- **תמונות לא עולות** — בדקו את log של Flask; אם Cloudinary נכשל, האפליקציה
  נופלת אוטומטית לאחסון מקומי.
- **Google Maps autocomplete לא עובד** — בדקו שהפניה ב-API key מכסה את הדומיין שלכם.
