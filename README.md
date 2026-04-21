# RentMate

פלטפורמת התאמה חכמה לחיפוש דירות ושותפים בשוק השכירות הישראלי. ממשק swipe
בסגנון Tinder, אלגוריתם התאמה לפי מיקום/תקציב/אורח חיים/תאריכים, ושיחות
בזמן אמת.

**צוות:** רומי אלנקרי אלון · עדי בן יעקב · עדן רפס · קוסטה זוייב
**מנחה:** דוד טוביאס · **מוסד:** האקדמית תל-אביב-יפו, אקסלרטור-ב חדשנות.

---

## דרישות

- Python 3.10+
- MySQL 5.7+ (ב-cPanel) או SQLite לפיתוח מקומי
- מפתחות API ל: Twilio · OpenAI · Google Maps · Firebase · Cloudinary
  (ראו `INTEGRATION_GUIDE.md` לפירוט איך להשיג כל אחד)

## התקנה מהירה (פיתוח מקומי)

```bash
git clone <repo> rentmate
cd rentmate

python -m venv .venv
source .venv/bin/activate         # או ב-Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# ערכו את .env והוסיפו מפתחות API (לפיתוח ראשוני אפשר להשאיר חלקם ריקים —
# כל שירות חיצוני שאין לו מפתח ייפול חזרה לערך "dev fallback" ברור)

python run.py
```

האפליקציה רצה על http://localhost:5000. משתמשי דמו (ראו `seed.py`):

```
+972501234001  —  יעל (שוכרת)
+972501234002  —  עומר (שותף)
+972501234003  —  דוד (משכיר)
+972501234004  —  שרה (משכירה + שותפה)
+972501234005  —  משה (משכיר)
```

בפיתוח ללא Twilio — קוד האימות הוא **000000**.

## יצירת נתוני דמו

```bash
python seed.py
```

יוצר 5 משתמשים, 10 דירות ו-10 פרסומים. דורס בבטחה אם יש כבר משתמשים ב-DB.

## הרצת בדיקות

```bash
FLASK_ENV=testing pytest -v
```

---

## העלאה ל-cPanel (פרודקשן)

### שלב 1: הכנת הקבצים
העלו את כל התיקייה (ללא `.venv/`, `.env`, `rentmate.db`) ל-cPanel
לתיקיית `~/rentmate`.

### שלב 2: MySQL
ב-cPanel:
1. **MySQL® Databases** → צרו `rentmate_db`
2. צרו משתמש `rentmate_user` עם סיסמה חזקה
3. הוסיפו את המשתמש ל-DB עם הרשאות מלאות
4. פתחו את phpMyAdmin ובחרו ב-`rentmate_db`, ייבאו את `schema.sql`

### שלב 3: Python App
ב-cPanel:
1. **Setup Python App** → **Create Application**
2. Python version: 3.10 (או גבוה יותר)
3. Application root: `~/rentmate`
4. Application URL: הדומיין/תת-דומיין הרצוי
5. Startup file: `passenger_wsgi.py`
6. Application Entry point: `application`
7. לחצו **Create**

### שלב 4: תלויות
1. בתיבת "Run pip install" הריצו: `pip install -r requirements.txt`
2. או דרך הטרמינל של cPanel:
   ```bash
   source /home/<user>/virtualenv/rentmate/3.10/bin/activate
   cd ~/rentmate
   pip install -r requirements.txt
   ```

### שלב 5: קובץ .env
ב-cPanel File Manager צרו קובץ `.env` בתיקיית `~/rentmate` לפי `.env.example`.
השורות הקריטיות:

```ini
FLASK_ENV=production
SECRET_KEY=<מחרוזת-אקראית-ארוכה-אמיתית>
DATABASE_URL=mysql+pymysql://rentmate_user:<password>@localhost/rentmate_db
APP_BASE_URL=https://<הדומיין-שלכם>
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=...
OPENAI_API_KEY=...
GOOGLE_MAPS_API_KEY=...
FIREBASE_CREDENTIALS_PATH=/home/<user>/rentmate/firebase-credentials.json
FIREBASE_PROJECT_ID=...
# ... (שאר המשתנים מ-.env.example)
```

> ⚠️ **חשוב:** `.env` **לא** נכנס ל-git. צרו אותו ישירות על השרת.

### שלב 6: Firebase credentials (אם משתמשים)
העלו את קובץ ה-service-account JSON של Firebase ל-`~/rentmate/firebase-credentials.json`
(או לנתיב שהוגדר ב-`FIREBASE_CREDENTIALS_PATH`). ודאו שהרשאות הקובץ הן 600.

### שלב 7: Restart + DB init
1. ב-Python App לחצו **Restart Application**
2. בטרמינל: `flask --app app:create_app db upgrade` (אם משתמשים ב-migrations)
   או הריצו `python seed.py` לנתוני דמו (אופציונלי)

### שלב 8: HTTPS
הפעילו Let's Encrypt מ-**SSL/TLS Status** ב-cPanel.
ודאו ש-`APP_BASE_URL` משתמש ב-`https://`.

---

## מבנה הפרויקט

```
rentmate/
├── passenger_wsgi.py     # cPanel entry
├── run.py                # local dev entry
├── config.py             # dev / prod / test config classes
├── requirements.txt
├── .env.example
├── schema.sql            # MySQL bootstrap
├── seed.py               # demo data
├── app/
│   ├── __init__.py       # create_app() factory
│   ├── extensions.py
│   ├── models/           # SQLAlchemy entities
│   ├── routes/           # Flask blueprints
│   ├── services/         # external API wrappers + matching engine
│   ├── utils/
│   ├── static/           # css, js, images
│   └── templates/        # Jinja2 pages
├── migrations/           # Alembic (optional; DB-first via schema.sql also works)
└── tests/
```

## מערכת המודולים

| מודול | Routes | UI | שירותים |
|------|--------|----|---------|
| Auth | `/auth/*` | login, verify, roles, profile | Twilio (OTP) |
| AI Agent | `/ai/*` | chat ב-gpt-4o-mini | OpenAI |
| Swipe | `/matches/*` | deck + detail drawer | matching_engine |
| Listings | `/listings/*` | wizard, detail, edit | Maps, Cloudinary |
| Chat | `/chat/*` | inbox + thread | Firestore (realtime), MySQL (archive) |
| Notifications | `/notifications/*` | bell + center | FCM push |
| Dashboard | `/dashboard/*` | landlord analytics + candidates | — |

## פיתוח

- הוספת מודל חדש → `app/models/xxx.py` + export ב-`app/models/__init__.py`
- הוספת blueprint חדש → `app/routes/xxx.py` + register ב-`app/__init__.py`
- אם הוספתם fields למודל קיים — צרו migration:
  ```bash
  flask db migrate -m "describe the change"
  flask db upgrade
  ```

## רישיון

פרטי — פרויקט גמר לימודי.
