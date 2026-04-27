import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import time
from datetime import datetime, timedelta
from functools import wraps

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, g, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
import openai


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
OTP_TTL_SECONDS = _env_int('OTP_TTL_SECONDS', 5 * 60)  # 5 minutes
OTP_MAX_ATTEMPTS = _env_int('OTP_MAX_ATTEMPTS', 5)
CHAT_MAX_CHARS = _env_int('CHAT_MAX_CHARS', 2000)
CHAT_MIN_INTERVAL_SECONDS = _env_int('CHAT_MIN_INTERVAL_SECONDS', 2)
CHAT_MAX_PER_HOUR = _env_int('CHAT_MAX_PER_HOUR', 60)

allowed_origin_raw = os.environ.get('ALLOWED_ORIGIN', '*')
if allowed_origin_raw.strip() == '*':
    CORS(app)
    log.warning('CORS is open to all origins (ALLOWED_ORIGIN=*).')
else:
    origins = [o.strip() for o in allowed_origin_raw.split(',') if o.strip()]
    CORS(app, resources={r'/api/*': {'origins': origins}})

db = SQLAlchemy(app)

# Import models after db is defined
import models  # noqa: E402

with app.app_context():
    db.create_all()

signer = URLSafeTimedSerializer(SECRET_KEY, salt='rentmate-auth')


# --- Auth helpers ---

def _hash_otp(code, phone):
    # Tie the hash to the phone so a leaked hash can't be replayed against another number.
    return hashlib.sha256(f'{phone}:{code}'.encode('utf-8')).hexdigest()


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


# --- API ENDPOINTS ---

PHONE_RE = re.compile(r'^[0-9+\-\s()]{6,20}$')


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    phone = (data.get('phone') or '').strip()
    if not phone or not PHONE_RE.match(phone):
        return jsonify({'error': 'Valid phone number required'}), 400

    # Invalidate any outstanding codes for this phone before issuing a new one.
    models.OtpCode.query.filter_by(phone=phone, consumed=False).update({'consumed': True})

    demo_otp = os.environ.get('DEMO_OTP')
    code = demo_otp if demo_otp else f'{secrets.randbelow(10000):04d}'
    entry = models.OtpCode(
        phone=phone,
        code_hash=_hash_otp(code, phone),
        expires_at=datetime.utcnow() + timedelta(seconds=OTP_TTL_SECONDS),
    )
    db.session.add(entry)
    db.session.commit()

    # In dev we return the code so the demo still works; in prod we'd send it via SMS.
    body = {'message': 'OTP sent', 'phone': phone}
    if app.config.get('DEBUG') or _env_bool('EXPOSE_OTP', False):
        body['otp'] = code
    else:
        log.info('Issued OTP for phone=%s (len=%d)', phone, len(code))
    return jsonify(body)


@app.route('/api/auth/verify', methods=['POST'])
def verify():
    data = request.get_json(silent=True) or {}
    phone = (data.get('phone') or '').strip()
    otp = (data.get('otp') or '').strip()
    if not phone or not otp:
        return jsonify({'error': 'Missing credentials'}), 400

    entry = (
        models.OtpCode.query
        .filter_by(phone=phone, consumed=False)
        .order_by(models.OtpCode.created_at.desc())
        .first()
    )
    if not entry:
        return jsonify({'error': 'No active code for this number'}), 401
    if entry.expires_at < datetime.utcnow():
        entry.consumed = True
        db.session.commit()
        return jsonify({'error': 'Code expired'}), 401
    if entry.attempts >= OTP_MAX_ATTEMPTS:
        entry.consumed = True
        db.session.commit()
        return jsonify({'error': 'Too many attempts'}), 429

    entry.attempts += 1
    expected = entry.code_hash
    got = _hash_otp(otp, phone)
    if not hmac.compare_digest(expected, got):
        db.session.commit()
        return jsonify({'error': 'Incorrect code'}), 401

    entry.consumed = True

    user = models.User.query.filter_by(phone=phone).first()
    if not user:
        user = models.User(phone=phone, role='renter')
        db.session.add(user)
    db.session.commit()

    token = _issue_token(user.id)
    return jsonify({'message': 'Verified', 'user_id': user.id, 'token': token})


@app.route('/api/profile', methods=['POST'])
@require_auth
def update_profile():
    data = request.get_json(silent=True) or {}
    user_id = g.user_id

    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
    if not profile:
        profile = models.PreferenceProfile(user_id=user_id)
        db.session.add(profile)

    name = (data.get('name') or '').strip()[:100]
    city = (data.get('city') or '').strip()[:100]
    budget_str = str(data.get('budget', ''))
    nums = re.findall(r'\d+', budget_str)
    try:
        budget = int(nums[0]) if nums else 4500
    except (ValueError, IndexError):
        budget = 4500
    if budget < 100:
        budget *= 1000
    budget = max(0, min(budget, 1_000_000))
    ptype = (data.get('type') or '').strip()[:50]
    extras = (data.get('extras') or '').strip()[:500]

    profile.name = name or profile.name
    profile.city = city or profile.city
    profile.max_budget = budget
    profile.type = ptype or profile.type
    profile.extras = extras or profile.extras

    db.session.commit()
    return jsonify({'message': 'Profile saved'})


@app.route('/api/properties', methods=['GET'])
@require_auth
def get_properties():
    user_id = g.user_id
    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()

    city = profile.city if profile and profile.city else 'תל אביב'
    base_price = profile.max_budget if profile and profile.max_budget and profile.max_budget > 0 else 4500

    props = models.Property.query.filter_by(location=city).all()
    if not props:
        prop1 = models.Property(
            title=f"סטודיו מואר ב{city}",
            price=base_price,
            location=city,
            image="https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80",
            tags="שקט,משופצת"
        )
        prop2 = models.Property(
            title=f"דירה מהממת ב{city}",
            price=base_price + 350,
            location=city,
            image="https://images.unsplash.com/photo-1502672260266-1c1de2d93688?auto=format&fit=crop&w=600&q=80",
            tags="מרווחת,זוגות"
        )
        prop3 = models.Property(
            title=f"לופט יוקרתי ליד הים",
            price=base_price + 1200,
            location=city,
            image="https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=80",
            tags="פרימיום,מרפסת"
        )
        db.session.add_all([prop1, prop2, prop3])
        db.session.commit()
        props = [prop1, prop2, prop3]

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

    api_key = os.environ.get('OPENAI_API_KEY')
    if api_key:
        openai.api_key = api_key
        try:
            response = openai.ChatCompletion.create(
                model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
                messages=messages,
                timeout=_env_int('OPENAI_TIMEOUT_SECONDS', 20),
            )
            ai_text = response.choices[0].message.content
        except (openai.error.OpenAIError, TimeoutError, ConnectionError) as e:
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
