
## RentMate — Swipe. Match. Move In.

### Tech Stack
- **Backend**: Python Flask, Flask-SQLAlchemy, Flask-Login, Flask-Bcrypt
- **Database**: SQLite (dev), MySQL (prod)
- **Frontend**: Jinja2 templates, vanilla JS, CSS3 (no framework)
- **Language**: RTL Hebrew interface for the Israeli market

### Getting Started
```bash
pip install -r requirements.txt
python app.py
# App runs at http://localhost:5000
# Seed data is auto-loaded on first run (5 users, 10 properties)
```

### Test Accounts
| Email | Password | Role |
|---|---|---|
| yael@example.com | password123 | Tenant |
| omer@example.com | password123 | Roommate |
| david@example.com | password123 | Landlord |

### Project Structure
```
rentmate/
├── app.py              # Main Flask app with all routes
├── models.py           # SQLAlchemy models (User, Property, etc.)
├── matching.py         # %Match scoring algorithm (0-100)
├── config.py           # App configuration
├── requirements.txt    # Python dependencies
├── templates/          # Jinja2 HTML templates
│   ├── base.html       # Base layout with navbar
│   ├── landing.html    # Homepage / hero
│   ├── register.html   # Registration (3-role selector)
│   ├── login.html      # Login page
│   ├── matches.html    # Tinder swipe page (core feature)
│   ├── search.html     # Property search with filters
│   ├── property_detail.html
│   ├── create_listing.html  # 4-step wizard
│   ├── edit_listing.html
│   ├── profile.html    # Profile & preferences (3 tabs)
│   └── chat.html       # Messaging page
└── static/
    ├── css/style.css   # All styles
    └── js/swipe.js     # Tinder swipe engine (vanilla JS)
```

### Key Architecture
- **Matching Algorithm** (`matching.py`): Scores 0-100 across 4 categories:
  - Location (30pts), Budget (35pts), Lifestyle (25pts), Dates (10pts)
- **API Routes**: JSON APIs under `/api/` for matches, properties, favorites, chat, profile
- **Page Routes**: Server-rendered Jinja2 templates for all pages
- **Auth**: Flask-Login session-based, bcrypt password hashing

### Conventions
- **Code style**: Python PEP 8, 4-space indent
- **API pattern**: `GET /api/<resource>` for lists, `POST /api/<resource>` for mutations
- **Templates**: One template per page, extends `base.html`
- **CSS**: Single `style.css` with section comments, BEM-ish class naming, CSS custom properties for theming
