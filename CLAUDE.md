# RentMate — Project Guide

Tinder-style rental matching platform for the Israeli market. Flask backend,
vanilla JS frontend, PWA-installable on mobile.

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env
python run.py          # dev (Socket.IO-aware, port 5000)
```

Production:

```bash
gunicorn -k eventlet -w 1 wsgi:app
# or: docker compose up
```

## Architecture

- **App factory** — `rentmate/__init__.py::create_app` builds the Flask app
  and registers blueprints. Entry points: `run.py` (dev), `wsgi.py` (prod),
  `app.py` (backwards-compat shim).
- **Extensions** — `rentmate/extensions.py` holds `db`, `socketio`, `limiter`,
  `mail`, `migrate`, `bcrypt` singletons to avoid circular imports.
- **Blueprints** in `rentmate/blueprints/`:
  - `core` landing + PWA assets
  - `auth` register / login / logout / email-verify / password-reset
  - `matches` swipe API
  - `properties` list / detail / create / edit / favorites (triggers match detection)
  - `profile` profile page + preference updates
  - `chat` HTTP chat API
  - `sockets` Socket.IO handlers — chat, presence, typing, notifications
  - `uploads` image upload + delete
  - `notifications` list + mark-read
- **Services** in `rentmate/services/`: `images` (Pillow pipeline), `chat`
  (shared message helpers), `email` (async Flask-Mail), `notifications`
  (DB row + socket emit + email), `matching_events` (mutual-match detection).
- **Schemas** in `rentmate/schemas/` are pydantic v2 — used at API boundaries
  and return 422 on `ValidationError`.
- **Models** at `/models.py` — `User`, `UserPreferences`, `Property`,
  `PropertyImage`, `Favorite`, `Conversation`, `Message`, `Notification`,
  `Match`.
- **Matching algorithm** at `/matching.py` (unchanged) — 0–100 score:
  location 30, budget 35, lifestyle 25, dates 10.

## Key flows

1. **Register → verify email** — POST `/register` creates user + sends
   verification email via `rentmate/utils/tokens.py` signed token.
2. **Swipe → like → mutual match** — `/api/favorites/toggle` records the
   like then calls `detect_mutual_match`. If both parties have favorited
   appropriately, a `Match` row is created and both get a socket event,
   DB notification, and email. Frontend `match-celebration.js` listens for
   `match:new` and shows the confetti modal.
3. **Real-time chat** — `static/js/rm-core.js` opens one Socket.IO
   connection per tab; `chat-socket.js` wires the chat page to it. Typing
   indicators + read receipts flow over the socket; new messages persist
   via `services/chat.create_message`.

## PWA

- `static/manifest.webmanifest`, `static/service-worker.js`, icons in
  `static/icons/`. Service worker uses stale-while-revalidate for app
  shell, cache-first for uploaded thumbs, network-first for `/api/*`.

## Rate limiting

Flask-Limiter default `200/hour;50/minute`. Specific: login `10/min`,
register `5/hour`, chat send `30/min`, image upload `20/hour`,
favorite toggle `60/min`, password-reset request `3/hour`.

## Tests

```bash
FLASK_ENV=test SECRET_KEY=test-secret pytest -v
```

Live CI: `.github/workflows/ci.yml` runs on push to `main` and `claude/**`
branches across Python 3.11 + 3.12.

## Environment variables

See `.env.example`. In prod, `SECRET_KEY` is required or `create_app` raises.
For multi-instance Socket.IO or rate-limit storage, set `REDIS_URL`.
`MAIL_*` vars wire Flask-Mail — defaults target MailHog.

## Seed data

`seed.py::seed_if_empty` creates demo landlords, tenants, and 10 properties
on a fresh DB. Skipped automatically under `TESTING=True`.
