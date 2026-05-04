import json
import logging
import os
import re
import time
from functools import wraps

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, g, jsonify, request

from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from openai import OpenAI, OpenAIError

from werkzeug.security import generate_password_hash, check_password_hash

def _env_bool(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {'1', 'true', 'yes', 'on'}


def _env_int(name, default):
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


logging.basicConfig(
    level=os.environ.get('LOG_LEVEL', 'INFO').upper(),
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
)
log = logging.getLogger('rentmate')

app = Flask(__name__)

# --- Config ---
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'rentmate_v3.db')
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if _env_bool('FLASK_DEBUG', False):
        SECRET_KEY = 'dev-only-do-not-use-in-prod'
        log.warning('SECRET_KEY not set; using dev fallback (debug mode).')
    else:
        raise RuntimeError('SECRET_KEY environment variable is required in non-debug mode.')
app.config['SECRET_KEY'] = SECRET_KEY

TOKEN_TTL_SECONDS = _env_int('TOKEN_TTL_SECONDS', 60 * 60 * 24 * 7)  # 7 days
CHAT_MAX_CHARS = _env_int('CHAT_MAX_CHARS', 2000)
CHAT_MIN_INTERVAL_SECONDS = _env_int('CHAT_MIN_INTERVAL_SECONDS', 2)
CHAT_MAX_PER_HOUR = _env_int('CHAT_MAX_PER_HOUR', 60)
LOGIN_MAX_PER_15_MIN = _env_int('LOGIN_MAX_PER_15_MIN', 10)
VALID_ROLES = {'renter', 'roommate', 'landlord'}

allowed_origin_raw = os.environ.get('ALLOWED_ORIGIN', '*')
if allowed_origin_raw.strip() == '*':
    if not _env_bool('FLASK_DEBUG', False):
        raise RuntimeError(
            'ALLOWED_ORIGIN=* is not permitted in non-debug mode. '
            'Set ALLOWED_ORIGIN to a comma-separated list of trusted origins.'
        )
    CORS(app)
    log.warning('CORS is open to all origins (ALLOWED_ORIGIN=*).')
else:
    origins = [o.strip() for o in allowed_origin_raw.split(',') if o.strip()]
    CORS(app, resources={r'/api/*': {'origins': origins}})

from extensions import db
db.init_app(app)

# Import models after db is defined
import models  # noqa: E402

DEMO_SEED_CITIES = [
    {
        'city': 'תל אביב',
        'base_price': 5500,
        'images': [
            'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1502672260266-1c1de2d93688?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80',
        ],
    },
    {
        'city': 'ירושלים',
        'base_price': 4200,
        'images': [
            'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=600&q=80',
            'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=80',
        ],
    },
]


def seed_demo_properties():
    """Idempotent seed of a small demo catalogue. Runs once on startup."""
    if models.Property.query.first() is not None:
        return
    for spec in DEMO_SEED_CITIES:
        city = spec['city']
        base = spec['base_price']
        for i, image in enumerate(spec['images']):
            db.session.add(
                models.Property(
                    title=(
                        f'סטודיו מואר ב{city}' if i == 0
                        else f'דירה מהממת ב{city}' if i == 1
                        else f'לופט יוקרתי ב{city}'
                    ),
                    price=base + i * 600,
                    location=city,
                    image=image,
                    tags='שקט,משופצת' if i == 0 else 'מרווחת,זוגות' if i == 1 else 'פרימיום,מרפסת',
                )
            )
    db.session.commit()


with app.app_context():
    db.create_all()
    seed_demo_properties()

signer = URLSafeTimedSerializer(SECRET_KEY, salt='rentmate-auth')

openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY')) if os.environ.get('OPENAI_API_KEY') else None




# --- Auth helpers ---



def _issue_token(user_id):
    return signer.dumps({'uid': int(user_id)})


def _load_token(token):
    try:
        payload = signer.loads(token, max_age=TOKEN_TTL_SECONDS)
    except SignatureExpired:
        return None, 'expired'
    except BadSignature:
        return None, 'invalid'
    uid = payload.get('uid') if isinstance(payload, dict) else None
    if not isinstance(uid, int):
        return None, 'invalid'
    return uid, None


def require_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return jsonify({'error': 'Missing bearer token'}), 401
        token = header[len('Bearer '):].strip()
        uid, err = _load_token(token)
        if err or uid is None:
            return jsonify({'error': 'Invalid or expired token'}), 401
        g.user_id = uid
        return func(*args, **kwargs)
    return wrapper


# --- Simple per-user rate limiter (in-memory; adequate for a single-process MVP) ---
_chat_rate = {}  # uid -> {'last': float, 'window_start': float, 'count': int}
_login_rate = {}  # ip -> [timestamp, ...] within the last 15 min


def _chat_rate_check(uid):
    now = time.time()
    state = _chat_rate.get(uid, {'last': 0.0, 'window_start': now, 'count': 0})
    if now - state['last'] < CHAT_MIN_INTERVAL_SECONDS:
        return False, 'Slow down'
    if now - state['window_start'] > 3600:
        state = {'last': now, 'window_start': now, 'count': 0}
    if state['count'] >= CHAT_MAX_PER_HOUR:
        return False, 'Hourly chat limit reached'
    state['last'] = now
    state['count'] += 1
    _chat_rate[uid] = state
    return True, None


def _login_rate_check(ip):
    """Throttles login + register by client IP. Resets per 15 min window."""
    now = time.time()
    cutoff = now - 15 * 60
    bucket = [t for t in _login_rate.get(ip, []) if t > cutoff]
    if len(bucket) >= LOGIN_MAX_PER_15_MIN:
        _login_rate[ip] = bucket
        return False
    bucket.append(now)
    _login_rate[ip] = bucket
    return True


def _client_ip():
    fwd = request.headers.get('X-Forwarded-For', '')
    if fwd:
        return fwd.split(',')[0].strip()
    return request.remote_addr or 'unknown'


# --- API ENDPOINTS ---




@app.route('/api/auth/register', methods=['POST'])
def register():
    if not _login_rate_check(_client_ip()):
        return jsonify({'error': 'יותר מדי נסיונות, נסו שוב בעוד מספר דקות'}), 429

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')
    name = (data.get('name') or '').strip()
    role = (data.get('role') or 'renter').strip()
    if role not in VALID_ROLES:
        role = 'renter'

    if not email or not password:
        return jsonify({'error': 'אימייל וסיסמה הם שדות חובה'}), 400
    if len(password) < 6:
        return jsonify({'error': 'הסיסמה חייבת להכיל לפחות 6 תווים'}), 400

    existing_user = models.User.query.filter_by(email=email).first()
    if existing_user:
        return jsonify({'error': 'האימייל כבר קיים במערכת'}), 400

    hashed_pw = generate_password_hash(password)
    user = models.User(email=email, password_hash=hashed_pw, role=role)
    db.session.add(user)
    db.session.commit()

    if name:
        profile = models.PreferenceProfile(user_id=user.id, name=name)
        db.session.add(profile)
        db.session.commit()

    token = _issue_token(user.id)
    return jsonify({
        'message': 'נרשמת בהצלחה',
        'user_id': user.id,
        'token': token,
        'role': user.role,
        'profile_complete': False,
    })


@app.route('/api/auth/login', methods=['POST'])
def login():
    if not _login_rate_check(_client_ip()):
        return jsonify({'error': 'יותר מדי נסיונות, נסו שוב בעוד מספר דקות'}), 429

    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'אימייל וסיסמה הם שדות חובה'}), 400

    user = models.User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'אימייל או סיסמה שגויים'}), 401

    profile = models.PreferenceProfile.query.filter_by(user_id=user.id).first()
    profile_complete = bool(profile and profile.city and profile.max_budget)

    token = _issue_token(user.id)
    return jsonify({
        'message': 'התחברת בהצלחה',
        'user_id': user.id,
        'token': token,
        'role': user.role,
        'profile_complete': profile_complete,
    })


@app.route('/api/profile', methods=['GET'])
@require_auth
def get_profile():
    user = db.session.get(models.User, g.user_id)
    if user is None:
        return jsonify({'error': 'User not found'}), 404
    profile = models.PreferenceProfile.query.filter_by(user_id=user.id).first()
    payload = {
        'role': user.role,
        'profile_complete': bool(profile and profile.city and profile.max_budget),
        'profile': {
            'name': profile.name if profile else None,
            'city': profile.city if profile else None,
            'budget': profile.max_budget if profile else None,
            'type': profile.type if profile else None,
            'extras': profile.extras if profile else None,
        },
    }
    return jsonify(payload)


@app.route('/api/profile', methods=['POST'])
@require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    user_id = g.user_id

    user = db.session.get(models.User, user_id)
    if user is None:
        return jsonify({'error': 'User not found'}), 404

    role = (data.get('role') or '').strip()
    if role and role in VALID_ROLES:
        user.role = role

    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = models.PreferenceProfile(user_id=user_id)
        db.session.add(profile)

    name = (data.get('name') or '').strip()[:100]
    city = (data.get('city') or '').strip()[:100]
    budget_raw = data.get('budget')
    try:
        budget = int(budget_raw) if budget_raw not in (None, '') else (profile.max_budget or 0)
    except (TypeError, ValueError):
        nums = re.findall(r'\d+', str(budget_raw))
        budget = int(nums[0]) if nums else (profile.max_budget or 0)
    budget = max(0, min(budget, 1_000_000))
    ptype = (data.get('type') or '').strip()[:50]
    extras = (data.get('extras') or '').strip()[:500]

    profile.name = name or profile.name
    profile.city = city or profile.city
    profile.max_budget = budget
    profile.type = ptype or profile.type
    profile.extras = extras or profile.extras

    db.session.commit()
    return jsonify({'message': 'Profile saved', 'role': user.role})


@app.route('/api/properties', methods=['GET'])
@require_auth
def get_properties():
    user_id = g.user_id
    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()

    city = profile.city if profile and profile.city else None
    base_price = profile.max_budget if profile and profile.max_budget and profile.max_budget > 0 else 4500

    query = models.Property.query
    if city:
        in_city = query.filter_by(location=city).all()
        props = in_city if in_city else query.all()
    else:
        props = query.all()

    result = []
    for p in props:
        result.append({
            'id': p.id,
            'title': p.title,
            'price': f"₪{p.price:,}/חודש",
            'image': p.image,
            'matchScore': 98 if p.price <= base_price else 88,
            'tags': p.tags.split(',') if p.tags else []
        })

    return jsonify(result)


@app.route('/api/swipe', methods=['POST'])
@require_auth
def swipe():
    data = request.get_json(silent=True) or {}
    user_id = g.user_id
    property_id = data.get('property_id')
    direction = data.get('direction')

    if not property_id or direction not in ('right', 'left', 'up'):
        return jsonify({'error': 'Missing or invalid fields'}), 400

    prop = db.session.get(models.Property, property_id)
    if not prop:
        return jsonify({'error': 'Unknown property'}), 404

    swipe = models.Swipe(user_id=user_id, property_id=property_id, direction=direction)
    db.session.add(swipe)

    # A real match requires a signal from the property owner side, which this MVP does not model.
    # We record the user's interest and let the UI confirm it without claiming a mutual match.
    is_match = False
    if direction in ('right', 'up'):
        existing_match = (
            models.Match.query
            .filter_by(user_id=user_id, property_id=property_id)
            .first()
        )
        is_match = existing_match is not None

    db.session.commit()
    return jsonify({'success': True, 'interestSent': direction in ('right', 'up'), 'isMatch': is_match})


@app.route('/api/chat', methods=['POST'])
@require_auth
def chat():
    data = request.get_json(silent=True) or {}
    user_id = g.user_id
    text = (data.get('text') or '').strip()
    if not text:
        return jsonify({'error': 'Missing text'}), 400
    if len(text) > CHAT_MAX_CHARS:
        return jsonify({'error': f'Message too long (max {CHAT_MAX_CHARS} characters)'}), 413

    ok, err = _chat_rate_check(user_id)
    if not ok:
        return jsonify({'error': err}), 429

    user_msg = models.ChatMessage(user_id=user_id, role='user', content=text)
    db.session.add(user_msg)
    db.session.commit()

    history = (
        models.ChatMessage.query
        .filter_by(user_id=user_id)
        .order_by(models.ChatMessage.created_at)
        .limit(40)
        .all()
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are RentMate AI. Ask the user questions to discover their apartment "
                "preferences (budget, city, roommates, etc). Be friendly, short, and "
                "conversational. Speak in Hebrew. When you have enough info to create a "
                "profile, output a JSON object starting with 'PROFILE_JSON=' followed by the "
                "JSON string containing: {'name', 'city', 'budget', 'type', 'extras'}. Do NOT "
                "output the JSON until you are sure you have at least a city and budget."
            ),
        }
    ]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})

    if openai_client is not None:
        try:
            response = openai_client.chat.completions.create(
                model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
                messages=messages,
                timeout=_env_int('OPENAI_TIMEOUT_SECONDS', 20),
            )
            ai_text = response.choices[0].message.content
        except (OpenAIError, TimeoutError, ConnectionError) as e:
            log.exception('OpenAI call failed: %s', e)
            ai_text = "סליחה, יש לי קצת עומס במערכת. תוכל לחזור על זה?"
    else:
        if 'תל אביב' in text or '5000' in text:
            ai_text = 'PROFILE_JSON={"name":"משתמש","city":"תל אביב","budget":5000,"type":"לבד","extras":"מרפסת"}'
        else:
            ai_text = "מעולה! איפה היית רוצה לגור ומה התקציב שלך? (גרסת דמו)"

    profile_complete = False
    if 'PROFILE_JSON=' in ai_text:
        json_str = ai_text.split('PROFILE_JSON=', 1)[1].strip()
        try:
            profile_data = json.loads(json_str)
            if not isinstance(profile_data, dict):
                raise ValueError('profile payload is not an object')
            profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
            if not profile:
                profile = models.PreferenceProfile(user_id=user_id)
                db.session.add(profile)
            profile.name = str(profile_data.get('name', 'משתמש'))[:100]
            profile.city = str(profile_data.get('city', 'תל אביב'))[:100]
            try:
                profile.max_budget = int(profile_data.get('budget', 4500))
            except (TypeError, ValueError):
                profile.max_budget = 4500
            profile.type = str(profile_data.get('type', ''))[:50]
            profile.extras = str(profile_data.get('extras', ''))[:500]
            db.session.commit()
            profile_complete = True
            ai_text = "מעולה! בניתי לך פרופיל אישי. מעביר אותך לדירות..."
        except (ValueError, TypeError) as e:
            log.warning('Failed to parse PROFILE_JSON payload: %s', e)
            ai_text = "הייתה בעיה בשמירת הפרופיל, בוא ננסה שוב."

    ai_msg = models.ChatMessage(user_id=user_id, role='assistant', content=ai_text)
    db.session.add(ai_msg)
    db.session.commit()

    return jsonify({'response': ai_text, 'profile_complete': profile_complete})


if __name__ == '__main__':
    app.run(debug=_env_bool('FLASK_DEBUG', False), port=_env_int('PORT', 5000))
