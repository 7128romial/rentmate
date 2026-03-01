# CLAUDE.md — RentMate Project Guide

> **Swipe. Match. Move In.**
> Israel's smart rental matching platform.

## Project Overview

RentMate is a Tinder-style apartment matching platform for the Israeli rental market. Instead of endless scrolling through Yad2 and Facebook groups, users build a profile with their preferences (budget, city, lifestyle, move-in date), and a weighted scoring algorithm ranks every listing with a **%Match score from 0–100**. Users swipe through top matches — like Tinder — to find their next home.

### Current State

- **Repository:** `7128romial/rentmate` on GitHub
- **Default branch:** `master`
- **Status:** Greenfield — no application code yet. This file defines the target architecture.

### Three User Types

| Role       | Description                                  |
|------------|----------------------------------------------|
| **Tenant** | Looking for a full apartment to rent         |
| **Roommate** | Looking for a room in a shared apartment  |
| **Landlord** | Publishing apartments for rent             |

---

## Tech Stack

| Layer        | Technology                                      |
|--------------|------------------------------------------------|
| Backend      | Python Flask, Flask-SQLAlchemy, Flask-Login, Flask-Bcrypt |
| Database     | SQLite (development), MySQL (production)        |
| Chat         | Firebase Realtime Database                      |
| Frontend     | Jinja2 templates + vanilla JavaScript           |
| Language/RTL | Hebrew (RTL interface), Israeli market          |

### Auto-Detection Rule

Use SQLite when `DB_PASSWORD` environment variable is empty or unset. Otherwise connect to MySQL.

---

## %Match Algorithm

Every apartment receives a score out of 100, broken into four weighted categories:

| Category     | Weight | Logic                                                         |
|-------------|--------|---------------------------------------------------------------|
| Location    | 30 pts | Exact city = 30, same region = 15, different = 0             |
| Budget      | 35 pts | ≤70% of max = 35, ≤85% = 30, ≤100% = 25, +10% over = 10, >10% over = 0 |
| Lifestyle   | 25 pts | Smoking + pets + gender weighted, normalized to 25            |
| Dates       | 10 pts | ≤7 days = 10, ≤30 days = 7, ≤60 days = 4, >60 days = 0     |

**Function signature:** `calculate_match_score(user_prefs, property) -> {total, location, budget, lifestyle, dates}`

---

## Database Models

### User
`id, email, password_hash, first_name, last_name, phone, age, gender, city, profile_image, is_verified, created_at`

### UserRole
`user_id, role` — enum: `tenant`, `roommate`, `landlord`

### UserPreferences
`user_id, preferred_city, max_rent, smoking` (yes/no/outdoor), `pets` (bool), `cleanliness_level` (1–5), `noise_level` (quiet/moderate/social), `sleep_schedule` (early/normal/night), `preferred_gender, move_in_date, min_rental_months`

### Property
`id, landlord_id, title, description, city, neighborhood, address, property_type` (apartment/room/studio/house), `rooms, floor, size_sqm, rent_price, furnished, parking, elevator, balcony, ac, storage, pets_allowed, smoking_allowed, available_from, min_rental_months, roommate_gender, max_roommates, status` (active/paused/deleted), `created_at`

### PropertyImage
`id, property_id, image_url, is_primary`

### Match
`id, user_id, property_id, match_score, score_breakdown` (JSON)

### Favorite
`id, user_id, property_id, created_at`

### Conversation
`id, user1_id, user2_id, property_id, firebase_chat_id`

### Notification
`id, user_id, type, message, is_read, created_at`

---

## API Routes

### Auth
| Method | Route             | Description                    |
|--------|-------------------|--------------------------------|
| POST   | `/auth/register`  | Register new user              |
| POST   | `/auth/login`     | Login                          |
| GET    | `/auth/logout`    | Logout                         |
| GET    | `/auth/profile`   | Get current user profile       |
| PUT    | `/auth/profile`   | Update profile and preferences |

### Properties
| Method | Route                    | Description                          |
|--------|--------------------------|--------------------------------------|
| GET    | `/properties/`           | List properties (with query filters) |
| GET    | `/properties/<id>`       | Single property detail               |
| POST   | `/properties/create`     | Create new listing (landlord)        |
| PUT    | `/properties/<id>/edit`  | Edit listing                         |
| DELETE | `/properties/<id>`       | Delete listing                       |
| GET    | `/properties/my`         | Current user's own listings          |

### Matches
| Method | Route                  | Description                       |
|--------|------------------------|-----------------------------------|
| GET    | `/matches/`            | Get scored matches for current user |
| GET    | `/matches/score/<id>`  | Get match score for a single property |

### Chat
| Method | Route                    | Description                       |
|--------|--------------------------|-----------------------------------|
| POST   | `/chat/start/<user_id>`  | Start conversation with a user    |
| GET    | `/chat/conversations`    | List conversations for current user |

---

## Key Pages

1. **Landing page** — Hero with animated apartment cards, how-it-works steps, CTA
2. **Register** — Role selector (tenant/roommate/landlord), multi-step form
3. **Login** — Centered card, clean auth
4. **Matches (swipe page)** — Draggable card stack with %Match badge (core feature)
5. **Property search** — Filter sidebar + responsive grid of property cards
6. **Property detail** — Photo gallery, specs, match breakdown, contact landlord
7. **Create listing** — 4-step wizard form for landlords
8. **Profile & preferences** — Update lifestyle and housing preferences, tabbed UI
9. **Chat** — Real-time two-panel messaging between tenant and landlord

---

## UI/UX Design System

### Color Palette

| Token       | Value                              |
|-------------|------------------------------------|
| Primary     | Coral-red gradient `#FF4458 → #FF7854` |
| Background  | Warm white / light (`#FFFFFF`, `#F8FAFC`) |
| Text        | Dark grey / black                  |
| Success     | Green (match ≥80%)                 |
| Warning     | Amber (match 60–79%)              |
| Danger      | Coral/red (match <60%)            |

### Design Principles

- **Warm white / light background** — NOT dark mode. The app feels like a lifestyle product, not a tech tool.
- **Mobile-first** responsive design.
- Cards with soft shadows, rounded corners (16–24px border radius).
- Modern sans-serif font, clean and readable.
- RTL layout throughout (Hebrew).

### Swipe Card UX

- Show **3 cards** stacked: top (100% interactive), middle (96% scale, +12px offset), back (92% scale, +24px offset).
- Drag right → green glow + "LIKE" stamp. Drag left → red glow + "NOPE" stamp.
- Release past 100px threshold → card flies off with rotation. Below threshold → spring back.
- **Keyboard shortcuts:** `←` skip, `→` like, `↑` info, `Ctrl+Z` undo.

### Match Score Badge Colors

- Green: ≥80% match
- Amber: 60–79% match
- Coral/red: <60% match

---

## Target Project Structure

```
rentmate/
├── app/
│   ├── __init__.py          # Flask app factory
│   ├── config.py            # Config (SQLite/MySQL auto-detect)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py          # User, UserRole, UserPreferences
│   │   ├── property.py      # Property, PropertyImage
│   │   ├── match.py         # Match, Favorite
│   │   ├── conversation.py  # Conversation, Notification
│   │   └── seed.py          # Seed data
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py          # /auth/* routes
│   │   ├── properties.py    # /properties/* routes
│   │   ├── matches.py       # /matches/* routes
│   │   └── chat.py          # /chat/* routes
│   ├── services/
│   │   ├── matching.py      # calculate_match_score()
│   │   └── firebase.py      # Firebase chat integration
│   ├── templates/
│   │   ├── base.html        # Base layout (RTL, Hebrew)
│   │   ├── landing.html
│   │   ├── auth/
│   │   │   ├── register.html
│   │   │   └── login.html
│   │   ├── matches/
│   │   │   └── swipe.html
│   │   ├── properties/
│   │   │   ├── search.html
│   │   │   ├── detail.html
│   │   │   └── create.html
│   │   ├── profile/
│   │   │   └── settings.html
│   │   └── chat/
│   │       └── messages.html
│   └── static/
│       ├── css/
│       │   └── style.css    # Global styles, RTL, coral theme
│       ├── js/
│       │   ├── swipe.js     # Tinder card stack (vanilla JS)
│       │   ├── chat.js      # Firebase chat client
│       │   └── app.js       # Shared utilities
│       └── img/
├── migrations/              # Flask-Migrate / Alembic
├── tests/
├── requirements.txt
├── .env.example
├── .gitignore
├── CLAUDE.md
├── README.md
└── run.py                   # Entry point
```

---

## Environment Variables

```env
# .env.example
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=<random-secret>
DB_HOST=localhost
DB_NAME=rentmate
DB_USER=root
DB_PASSWORD=              # Leave empty to use SQLite
FIREBASE_API_KEY=<key>
FIREBASE_PROJECT_ID=<id>
```

---

## Getting Started (once code exists)

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set up environment
cp .env.example .env
# Edit .env with your values (leave DB_PASSWORD empty for SQLite)

# 4. Initialize database
flask db upgrade
python -c "from app.models.seed import seed_data; seed_data()"

# 5. Run development server
flask run
```

---

## Conventions

### Code Style
- Python: PEP 8, 4-space indentation
- JavaScript: vanilla JS, no external libraries for swipe component
- Templates: Jinja2 with consistent block naming (`{% block content %}`, `{% block scripts %}`)
- All user-facing text in **Hebrew**
- All API JSON responses in Hebrew where applicable

### Git Workflow
- Feature branches off `master`
- Descriptive commit messages in English
- One logical change per commit

### Error Handling
- Flask routes return JSON `{error: "message"}` with appropriate HTTP status codes
- Frontend shows inline error messages (red) and success toasts
- Validate at system boundaries: user input, API requests

### Security
- Passwords hashed with Flask-Bcrypt
- Flask-Login for session management
- CSRF protection on all forms
- Input validation on all API endpoints
- Never commit `.env` or credentials

---

## Instructions for AI Assistants

1. **This CLAUDE.md is the source of truth** for the project's target architecture. Follow it when generating code.
2. **Tech stack is decided:** Python Flask + SQLite/MySQL + Firebase + Jinja2 + vanilla JS. Do not suggest alternatives unless asked.
3. **RTL Hebrew** — all templates must use `dir="rtl"` and Hebrew labels.
4. **Match algorithm** — implement exactly as specified in the scoring table above. Do not change weights or thresholds.
5. **UI must be warm/light** — coral gradient accents on white background. Never use dark mode.
6. **The swipe page is the core feature** — prioritize its UX quality.
7. **Keep it simple** — no unnecessary abstractions, no external JS frameworks. Vanilla JS for frontend interactivity.
8. **Include seed data** — when creating the database layer, add sample users, properties, and preferences for development.
9. **Update this CLAUDE.md** whenever new patterns, dependencies, or conventions are established.
