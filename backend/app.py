import datetime
import json
import logging
import os
import re
import time
import base64
from functools import wraps

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, g, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
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
socketio = SocketIO(app, cors_allowed_origins="*")

# --- Config ---
basedir = os.path.abspath(os.path.dirname(__file__))
database_url = os.environ.get(
    'DATABASE_URL', 'sqlite:///' + os.path.join(basedir, 'rentmate_v3.db')
)
if database_url.startswith('postgres://'):
    database_url = 'postgresql://' + database_url[len('postgres://'):]
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

UPLOAD_FOLDER = os.path.join(basedir, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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
    try:
        # Check if the schema is compatible by running queries that touch
        # newly-added columns. If any fail, fall back to drop_all.
        models.Property.query.first()
        models.User.query.with_entities(models.User.subscription).first()
    except Exception as e:
        print(f"Schema mismatch detected ({e}), dropping tables to recreate.")
        db.drop_all()

    db.create_all()
    try:
        seed_demo_properties()
    except Exception as e:
        print(f"Seeding failed: {e}")
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
        # Make sure the user still exists — the DB can be reset between
        # deploys and a stale token would otherwise point at a missing FK.
        if not db.session.get(models.User, uid):
            return jsonify({'error': 'User no longer exists, please log in again'}), 401
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

@app.route('/uploads/<name>')
def download_file(name):
    return send_from_directory(app.config["UPLOAD_FOLDER"], name)

@app.route('/api/upload', methods=['POST'])
@require_auth
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if file:
        filename = secure_filename(file.filename)
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{int(time.time())}{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        url = request.host_url.rstrip('/') + f'/uploads/{filename}'
        return jsonify({'url': f'/uploads/{filename}'}) # Return relative URL to allow frontend to pass it back safely

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

@app.route('/api/analyze-property-image', methods=['POST'])
@require_auth
def analyze_property_image():
    if not openai_client:
        return jsonify({'error': 'OpenAI API not configured'}), 503
        
    data = request.get_json(silent=True) or {}
    url = data.get('url')
    if not url or not url.startswith('/uploads/'):
        # Maybe absolute URL? Strip host if so
        if '/uploads/' in str(url):
            url = '/uploads/' + url.split('/uploads/')[-1]
        else:
            return jsonify({'error': 'Invalid image URL'}), 400
            
    filename = url.split('/')[-1]
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
        
    try:
        base64_image = encode_image(filepath)
        
        response = openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "You are a real estate expert in Israel. Analyze this apartment image. Return a JSON object with 'description' (a short, attractive Hebrew marketing description of 2-3 sentences) and 'tags' (a list of 3-5 short Hebrew tags like 'מרווח', 'מואר', 'משופץ'). Only return valid JSON."},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                }
            ],
            response_format={ "type": "json_object" },
            max_tokens=300
        )
        result_text = response.choices[0].message.content
        result_json = json.loads(result_text)
        return jsonify(result_json)
    except Exception as e:
        log.exception('Vision API failed: %s', e)
        return jsonify({'error': 'Analysis failed'}), 500

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


@app.route('/api/reset', methods=['POST'])
@require_auth
def reset_account():
    user_id = g.user_id
    models.ChatMessage.query.filter_by(user_id=user_id).delete()
    models.PreferenceProfile.query.filter_by(user_id=user_id).delete()
    models.Swipe.query.filter_by(user_id=user_id).delete()
    models.Match.query.filter_by(user_id=user_id).delete()
    
    user = db.session.get(models.User, user_id)
    if user:
        user.role = 'renter'
        
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/properties', methods=['GET'])
@require_auth
def get_properties():
    # Only return properties that are 'available'
    user_id = g.user_id
    profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()

    city = profile.city if profile and profile.city else None
    base_price = profile.max_budget if profile and profile.max_budget and profile.max_budget > 0 else 4500

    query = models.Property.query.filter(
        models.Property.status == 'available',
        models.Property.owner_id != user_id,
    )
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
            'price': p.price_label if p.price_label else f"₪{p.price_max or p.price_min or 0}/חודש",
            'image': p.image,
            'matchScore': 98 if (p.price_max or 0) <= base_price else 88,
            'tags': p.tags.split(',') if p.tags else [],
            'address': p.address or p.location,
            'rooms': p.rooms,
            'area': p.area,
            'floor': p.floor,
            'totalFloors': p.total_floors,
            'available': p.available,
            'description': p.description,
            'amenities': json.loads(p.amenities) if p.amenities else []
        })

    return jsonify(result)

@app.route('/api/landlord/properties', methods=['GET'])
@require_auth
def get_landlord_properties():
    user_id = g.user_id
    props = models.Property.query.filter_by(owner_id=user_id).order_by(models.Property.created_at.desc()).all()
    result = []
    for p in props:
        pending = models.PropertyInterest.query.filter_by(property_id=p.id, status='pending').count()
        approved = models.PropertyInterest.query.filter_by(property_id=p.id, status='approved').count()
        result.append({
            'id': p.id,
            'title': p.title,
            'price': p.price_label,
            'priceMin': p.price_min,
            'priceMax': p.price_max,
            'address': p.address,
            'image': p.image,
            'status': p.status,
            'tags': p.tags.split(',') if p.tags else [],
            'pendingCount': pending,
            'approvedCount': approved,
        })
    return jsonify(result)

@app.route('/api/properties', methods=['POST'])
@require_auth
def create_property():
    data = request.get_json(silent=True) or {}
    user_id = g.user_id

    if not data.get('title'):
        return jsonify({'error': 'כותרת חסרה'}), 400
    if not data.get('address'):
        return jsonify({'error': 'כתובת חסרה'}), 400

    try:
        prop = models.Property(
            owner_id=user_id,
            title=data.get('title'),
            price_min=data.get('priceMin'),
            price_max=data.get('priceMax'),
            price_label=data.get('price'),
            location=data.get('location') or data.get('address'),
            address=data.get('address'),
            image=data.get('image'),
            tags=','.join(data.get('tags', [])),
            rooms=data.get('rooms'),
            area=data.get('area'),
            floor=data.get('floor'),
            total_floors=data.get('totalFloors'),
            available=data.get('available'),
            description=data.get('description'),
            amenities=json.dumps(data.get('amenities', [])),
            status=data.get('status', 'available')
        )
        db.session.add(prop)
        db.session.commit()
        return jsonify({'success': True, 'id': prop.id})
    except Exception as e:
        db.session.rollback()
        log.exception('Property creation failed: %s', e)
        return jsonify({'error': 'יצירת הדירה נכשלה. ייתכן שצריך להתחבר מחדש.'}), 500

@app.route('/api/landlord/properties/<int:prop_id>', methods=['GET'])
@require_auth
def get_landlord_property(prop_id):
    user_id = g.user_id
    p = db.session.get(models.Property, prop_id)
    if not p or p.owner_id != user_id:
        return jsonify({'error': 'Not found or unauthorized'}), 404
    return jsonify({
        'id': p.id,
        'title': p.title,
        'price': p.price_label,
        'priceMin': p.price_min,
        'priceMax': p.price_max,
        'address': p.address,
        'location': p.location,
        'image': p.image,
        'status': p.status,
        'tags': p.tags.split(',') if p.tags else [],
        'rooms': p.rooms,
        'area': p.area,
        'floor': p.floor,
        'totalFloors': p.total_floors,
        'available': p.available,
        'description': p.description,
        'amenities': json.loads(p.amenities) if p.amenities else [],
    })


@app.route('/api/landlord/properties/<int:prop_id>', methods=['PUT', 'PATCH'])
@require_auth
def update_property(prop_id):
    data = request.get_json(silent=True) or {}
    user_id = g.user_id
    prop = db.session.get(models.Property, prop_id)
    if not prop or prop.owner_id != user_id:
        return jsonify({'error': 'Not found or unauthorized'}), 404

    field_map = {
        'title': 'title',
        'priceMin': 'price_min',
        'priceMax': 'price_max',
        'price': 'price_label',
        'location': 'location',
        'address': 'address',
        'image': 'image',
        'rooms': 'rooms',
        'area': 'area',
        'floor': 'floor',
        'totalFloors': 'total_floors',
        'available': 'available',
        'description': 'description',
        'status': 'status',
    }
    for in_key, col in field_map.items():
        if in_key in data:
            setattr(prop, col, data[in_key])

    if 'tags' in data and isinstance(data['tags'], list):
        prop.tags = ','.join(str(t) for t in data['tags'])
    if 'amenities' in data and isinstance(data['amenities'], list):
        prop.amenities = json.dumps(data['amenities'])

    if 'address' in data and 'location' not in data:
        prop.location = data['address']

    db.session.commit()
    return jsonify({'success': True, 'id': prop.id})


SUBSCRIPTION_PRICE_NIS = 29
SUBSCRIPTION_PERIOD_DAYS = 30


@app.route('/api/subscription', methods=['GET'])
@require_auth
def get_subscription():
    user = db.session.get(models.User, g.user_id)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    tier = user.subscription or 'free'
    until = user.subscription_until.isoformat() if user.subscription_until else None
    # Auto-downgrade expired pro subscriptions
    if tier == 'pro' and user.subscription_until and user.subscription_until < datetime.datetime.utcnow():
        user.subscription = 'free'
        user.subscription_until = None
        db.session.commit()
        tier = 'free'
        until = None
    return jsonify({'tier': tier, 'until': until, 'price_nis': SUBSCRIPTION_PRICE_NIS})


@app.route('/api/subscription/checkout', methods=['POST'])
@require_auth
def create_subscription_checkout():
    # Returns a mock checkout intent. Real Stripe integration would create a
    # Stripe PaymentIntent here and return its client_secret. The frontend
    # collects payment details and calls /confirm with the intent id.
    import secrets
    intent = f"mock_pi_{secrets.token_urlsafe(12)}"
    return jsonify({
        'intent_id': intent,
        'price_nis': SUBSCRIPTION_PRICE_NIS,
        'period_days': SUBSCRIPTION_PERIOD_DAYS,
        'provider': 'mock',
    })


@app.route('/api/subscription/confirm', methods=['POST'])
@require_auth
def confirm_subscription():
    data = request.get_json(silent=True) or {}
    intent_id = (data.get('intent_id') or '').strip()
    if not intent_id.startswith('mock_pi_'):
        # When real Stripe is wired in, look up the intent and verify it's paid.
        return jsonify({'error': 'Invalid checkout intent'}), 400
    user = db.session.get(models.User, g.user_id)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    user.subscription = 'pro'
    user.subscription_until = datetime.datetime.utcnow() + datetime.timedelta(days=SUBSCRIPTION_PERIOD_DAYS)
    db.session.commit()
    return jsonify({
        'tier': user.subscription,
        'until': user.subscription_until.isoformat(),
    })


@app.route('/api/subscription/cancel', methods=['POST'])
@require_auth
def cancel_subscription():
    user = db.session.get(models.User, g.user_id)
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    user.subscription = 'free'
    user.subscription_until = None
    db.session.commit()
    return jsonify({'tier': 'free', 'until': None})


@app.route('/api/landlord/properties/<int:prop_id>/status', methods=['POST'])
@require_auth
def update_property_status(prop_id):
    data = request.get_json(silent=True) or {}
    user_id = g.user_id
    prop = db.session.get(models.Property, prop_id)
    if not prop or prop.owner_id != user_id:
        return jsonify({'error': 'Not found or unauthorized'}), 404
    
    status = data.get('status')
    if status in ('available', 'rented', 'pending', 'off_market'):
        prop.status = status
        db.session.commit()
        return jsonify({'success': True})
    return jsonify({'error': 'Invalid status'}), 400


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

    is_match = False
    if direction in ('right', 'up'):
        interest = models.PropertyInterest.query.filter_by(property_id=property_id, renter_id=user_id).first()
        if not interest:
            interest = models.PropertyInterest(property_id=property_id, renter_id=user_id, status='pending')
            db.session.add(interest)
            
        existing_match = (
            models.Match.query
            .filter_by(user_id=user_id, property_id=property_id)
            .first()
        )
        is_match = existing_match is not None

    db.session.commit()
    return jsonify({'success': True, 'interestSent': direction in ('right', 'up'), 'isMatch': is_match})

@app.route('/api/landlord/approve', methods=['POST'])
@require_auth
def landlord_approve():
    data = request.get_json(silent=True) or {}
    renter_id = data.get('renter_id')
    property_id = data.get('property_id')
    
    prop = db.session.get(models.Property, property_id)
    if not prop or prop.owner_id != g.user_id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    interest = models.PropertyInterest.query.filter_by(property_id=property_id, renter_id=renter_id).first()
    if interest:
        interest.status = 'approved'
        
    match = models.Match.query.filter_by(property_id=property_id, user_id=renter_id).first()
    if not match:
        match = models.Match(property_id=property_id, user_id=renter_id)
        db.session.add(match)
        
    db.session.commit()
    return jsonify({'success': True})

@app.route('/api/landlord/reject', methods=['POST'])
@require_auth
def landlord_reject():
    data = request.get_json(silent=True) or {}
    renter_id = data.get('renter_id')
    property_id = data.get('property_id')
    
    prop = db.session.get(models.Property, property_id)
    if not prop or prop.owner_id != g.user_id:
        return jsonify({'error': 'Unauthorized'}), 403
        
    interest = models.PropertyInterest.query.filter_by(property_id=property_id, renter_id=renter_id).first()
    if interest:
        interest.status = 'rejected'
        db.session.commit()
    return jsonify({'success': True})

@app.route('/api/lease/generate', methods=['POST'])
@require_auth
def generate_lease():
    if not openai_client:
        return jsonify({'error': 'OpenAI API not configured'}), 503

    data = request.get_json(silent=True) or {}
    prop = data.get('property') or {}
    lease_type = data.get('lease_type') or 'standard'
    landlord_name = (data.get('landlord_name') or '').strip() or 'המשכיר'
    renter_name = (data.get('renter_name') or '').strip() or 'השוכר'

    address = prop.get('address') or prop.get('location') or 'כתובת הנכס'
    if prop.get('price'):
        rent = prop['price']
    elif prop.get('price_max'):
        rent = f"₪{prop['price_max']}/חודש"
    else:
        rent = '____'
    rooms = prop.get('rooms') if prop.get('rooms') is not None else '___'

    if lease_type == 'roommate':
        prompt = f"""
You are a legal assistant in Israel. Write a concise SHARED-APARTMENT roommate agreement (הסכם שותפות בדירה) in Hebrew.
Format the output entirely in clean HTML. Do NOT use markdown code blocks. Return raw HTML only.
Use tags <h1>, <h2>, <p>, <ul>, <li>, <strong>.

Details:
- Existing tenant (host): {landlord_name}
- New roommate: {renter_name}
- Apartment address: {address}
- Monthly rent share: {rent}
- Rooms in apartment: {rooms}

Include short clauses for: rent split, shared bills (electricity/water/internet), shared spaces & private room, house rules, notice period (30 days), security deposit, dispute resolution, signatures.
Use placeholders like __________ for ID numbers, dates, and signatures.
Keep it short (max 300 words).
"""
    else:
        prompt = f"""
You are a legal assistant in Israel. Write a standard concise apartment lease agreement (חוזה שכירות בלתי מוגנת) in Hebrew.
Format the output entirely in clean HTML. Do NOT use markdown code blocks. Return raw HTML only.
Use tags <h1>, <h2>, <p>, <ul>, <li>, <strong>.

Details:
- Landlord: {landlord_name}
- Tenant: {renter_name}
- Property address: {address}
- Monthly rent: {rent}
- Rooms: {rooms}

Include short clauses for: purpose of lease, lease period (12 months), rent payment, security deposit & guarantees, utilities/property tax, maintenance, signatures.
Use placeholders like __________ for ID numbers, dates, and signatures.
Keep it short (max 300 words).
"""

    try:
        response = openai_client.with_options(max_retries=1).chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=800,
            timeout=_env_int('LEASE_TIMEOUT_SECONDS', 60),
        )
        html_content = response.choices[0].message.content or ''
        if html_content.startswith('```html'):
            html_content = html_content[7:]
        if html_content.endswith('```'):
            html_content = html_content[:-3]
        return jsonify({'html': html_content.strip()})
    except Exception as e:
        log.exception('Lease generation failed: %s', e)
        return jsonify({'error': 'Failed to generate lease'}), 500

@app.route('/api/roommates/compatibility/<int:target_user_id>', methods=['GET'])
@require_auth
def roommate_compatibility(target_user_id):
    if not openai_client:
        return jsonify({'score': 85, 'explanation': 'מערכת ה-AI כרגע לא זמינה (מצב דמו). נראה שיש לכם תחומי עניין משותפים!'})
        
    user_id = g.user_id
    if user_id == target_user_id:
        return jsonify({'score': 100, 'explanation': 'זה הפרופיל שלך!'})
        
    my_profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
    target_profile = models.PreferenceProfile.query.filter_by(user_id=target_user_id).first()
    
    if not my_profile or not target_profile:
        return jsonify({'score': 80, 'explanation': 'חסרים פרטים לחישוב התאמה מדויקת, אבל כדאי לדבר!'})
        
    prompt = f"""
    You are an expert roommate matchmaker in Israel.
    Compare these two people and give a compatibility score out of 100, and a 1-sentence friendly explanation in Hebrew.
    
    Person A (Searching):
    Name: {my_profile.name}
    City: {my_profile.city}
    Budget: {my_profile.max_budget}
    Type: {my_profile.type}
    Extras (Lifestyle): {my_profile.extras}
    
    Person B (Potential Roommate):
    Name: {target_profile.name}
    City: {target_profile.city}
    Budget: {target_profile.max_budget}
    Type: {target_profile.type}
    Extras (Lifestyle): {target_profile.extras}
    
    Return a JSON object with 'score' (integer 0-100) and 'explanation' (string in Hebrew, max 15 words).
    """
    
    try:
        response = openai_client.chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=[{"role": "user", "content": prompt}],
            response_format={ "type": "json_object" },
            max_tokens=300
        )
        result_json = json.loads(response.choices[0].message.content)
        return jsonify({
            'score': result_json.get('score', 85),
            'explanation': result_json.get('explanation', 'נראה שיש ביניכם התאמה טובה!')
        })
    except Exception as e:
        log.exception('Compatibility check failed: %s', e)
        return jsonify({'score': 85, 'explanation': 'התאמה כללית, כדאי לשוחח ולהכיר!'})

@app.route('/api/chat/roleplay', methods=['POST'])
@require_auth
def chat_roleplay():
    if not openai_client:
        return jsonify({'reply': 'אהלן! נראה לי שיהיה לנו מעניין לדבר. ספר/י קצת על עצמך?'})

    data = request.get_json(silent=True) or {}
    history = data.get('history') or []
    prop = data.get('property') or {}
    persona = (data.get('persona') or 'landlord').strip()
    other_name = (data.get('other_name') or '').strip()

    address = prop.get('address') or prop.get('location') or 'הדירה'
    if prop.get('price'):
        rent = prop['price']
    elif prop.get('price_max'):
        rent = f"₪{prop['price_max']}/חודש"
    else:
        rent = ''
    rooms = prop.get('rooms')
    available = prop.get('available')

    persona_briefs = {
        'landlord': f"You are the landlord of an apartment at {address}. The user just matched with your listing and is a potential tenant. You want to find a serious, respectful tenant.",
        'tenant': f"You are a tenant who matched with the user's apartment at {address}. You're considering renting it and are asking questions before committing.",
        'roommate_host': f"You currently live in an apartment at {address} and are looking for a roommate. The user is a potential roommate who matched with your post.",
        'roommate_seeker': f"You are looking for a place to share. The user has a room available at {address} that you matched with.",
        'roommate_peer': "You are also looking for a shared apartment to rent. The user matched with you because you have similar preferences. You're chatting to see if you'd like to team up and look for an apartment together.",
    }
    persona_brief = persona_briefs.get(persona, persona_briefs['landlord'])

    extra_details = []
    if rent:
        extra_details.append(f"Monthly rent: {rent}")
    if rooms is not None:
        extra_details.append(f"Rooms: {rooms}")
    if available:
        extra_details.append(f"Available from: {available}")
    details_block = ('\n'.join(f'- {d}' for d in extra_details)) if extra_details else '(no extra details)'

    name_line = f"Your first name is {other_name}." if other_name else "Pick a realistic Israeli first name and stick with it."

    system = (
        f"{persona_brief}\n"
        f"{name_line}\n"
        f"Apartment details you can reference if asked:\n{details_block}\n\n"
        "Respond in Hebrew like a real WhatsApp message — casual, friendly, 1-2 short sentences.\n"
        "CRITICAL: write replies in Hebrew script ONLY. Never use Arabic script. "
        "Echo names, places, and proper nouns exactly as the user wrote them — never transliterate.\n"
        "Stay in character. Ask one relevant question or share one relevant detail at a time.\n"
        "Don't reveal you're an AI. Don't use emoji-heavy or overly formal language.\n"
        "If the user wants to schedule a viewing, suggest concrete times. If they ask about price, refer to the rent above."
    )

    messages = [{"role": "system", "content": system}]
    for msg in history[-15:]:
        if not isinstance(msg, dict):
            continue
        role = 'user' if msg.get('role') == 'user' else 'assistant'
        content = (msg.get('content') or '').strip()
        if content:
            messages.append({"role": role, "content": content})

    if len(messages) == 1:
        messages.append({"role": "user", "content": "(אין הודעות עדיין — פתח/י את השיחה בהודעת קבלת פנים קצרה ושאלה אחת.)"})

    try:
        response = openai_client.with_options(max_retries=1).chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=messages,
            max_tokens=150,
            timeout=_env_int('OPENAI_TIMEOUT_SECONDS', 20),
        )
        reply = (response.choices[0].message.content or '').strip()
        if not reply:
            reply = 'מצטער/ת, פספסתי את ההודעה. תוכל/י לחזור עליה?'
        return jsonify({'reply': reply})
    except Exception as e:
        log.exception('Chat roleplay failed: %s', e)
        return jsonify({'reply': 'סליחה, אני בדרכים כרגע — אכתוב לך בעוד רגע!'})

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
                "You are RentMate AI. You assist users in Hebrew. Discover their goal first, there are 4 paths: "
                "1) renter (wants to rent an apartment) 2) landlord (wants to rent out their apartment) "
                "3) roommate_seeker (looking for a roommate) 4) roommate_host (has an apartment, needs a roommate). "
                "Ask relevant follow-ups (city, budget/price, name, extras/lifestyle). Be friendly, short, and conversational. "
                "CRITICAL: Always write your replies in Hebrew script ONLY. Never use Arabic script. "
                "When echoing back the user's name, city, or any proper noun, copy the exact characters they typed — do NOT transliterate to a different script. "
                "If the user typed a name in Hebrew letters, repeat it in Hebrew letters. "
                "When you have enough info to create their profile, output a JSON object starting with 'PROFILE_JSON=' "
                "followed by the JSON string containing: {'role': 'renter'|'landlord'|'roommate', "
                "'subrole': 'seeker'|'host' (if roommate), 'name', 'city', 'budget', 'type', 'extras'}. "
                "Do NOT output the JSON until you have the core info."
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
    assigned_role = None
    assigned_subrole = None
    saved_profile = None

    if 'PROFILE_JSON=' in ai_text:
        raw_json_str = ai_text.split('PROFILE_JSON=', 1)[1].strip()
        start_idx = raw_json_str.find('{')
        end_idx = raw_json_str.rfind('}')
        if start_idx != -1 and end_idx != -1 and end_idx >= start_idx:
            json_str = raw_json_str[start_idx:end_idx+1]
        else:
            json_str = raw_json_str
            
        try:
            profile_data = json.loads(json_str)
            if not isinstance(profile_data, dict):
                raise ValueError('profile payload is not an object')
            profile = models.PreferenceProfile.query.filter_by(user_id=user_id).first()
            if not profile:
                profile = models.PreferenceProfile(user_id=user_id)
                db.session.add(profile)
            
            user = db.session.get(models.User, user_id)
            if 'role' in profile_data and profile_data['role'] in VALID_ROLES:
                user.role = profile_data['role']
                assigned_role = user.role
            else:
                assigned_role = user.role

            assigned_subrole = profile_data.get('subrole')

            profile.name = str(profile_data.get('name', 'משתמש'))[:100]
            profile.city = str(profile_data.get('city', 'תל אביב'))[:100]
            try:
                profile.max_budget = int(profile_data.get('budget', 4500))
            except (TypeError, ValueError):
                profile.max_budget = 4500
            
            subr = str(profile_data.get('subrole', ''))
            ptyp = str(profile_data.get('type', ''))
            profile.type = f"{ptyp} {subr}".strip()[:50]
            profile.extras = str(profile_data.get('extras', ''))[:500]
            db.session.commit()
            profile_complete = True
            saved_profile = {
                'name': profile.name,
                'city': profile.city,
                'budget': profile.max_budget,
                'type': profile.type,
                'extras': profile.extras,
            }

            if assigned_role == 'landlord':
                ai_text = "מעולה! אני פותח לך את ממשק ניהול הנכסים 🔑"
            elif assigned_role == 'roommate':
                ai_text = "מצוין! בונה לך פרופיל שותפים ומעביר אותך לחיפוש 🤝"
            else:
                ai_text = "מעולה! בניתי לך פרופיל אישי. מעביר אותך לדירות ✨"
                
        except (ValueError, TypeError) as e:
            log.warning('Failed to parse PROFILE_JSON payload: %s', e)
            ai_text = "הייתה בעיה בשמירת הפרופיל, בוא ננסה שוב."

    ai_msg = models.ChatMessage(user_id=user_id, role='assistant', content=ai_text)
    db.session.add(ai_msg)
    db.session.commit()

    return jsonify({
        'response': ai_text,
        'profile_complete': profile_complete,
        'role': assigned_role,
        'subrole': assigned_subrole,
        'profile': saved_profile,
    })


PROPERTY_EXTRACTION_TOOL = {
    "type": "function",
    "function": {
        "name": "fill_property_form",
        "description": (
            "Update the apartment listing form with any details mentioned so far, "
            "and ask one friendly follow-up question (in Hebrew) about the most important "
            "missing field. Always include the function call, even on the first turn."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "extracted": {
                    "type": "object",
                    "description": "Property fields extracted from the conversation. Omit fields you have no info for.",
                    "properties": {
                        "title": {"type": "string", "description": "Short Hebrew listing title, e.g. 'דירת 3 חדרים בלב רוטשילד'."},
                        "price_min": {"type": "integer", "description": "Minimum monthly rent in NIS."},
                        "price_max": {"type": "integer", "description": "Maximum monthly rent in NIS."},
                        "address": {"type": "string", "description": "Street address including city if known."},
                        "rooms": {"type": "number", "description": "Number of rooms (allow halves like 2.5)."},
                        "area": {"type": "integer", "description": "Apartment area in square meters."},
                        "floor": {"type": "integer", "description": "Floor of the apartment."},
                        "total_floors": {"type": "integer", "description": "Total floors in the building."},
                        "available": {"type": "string", "description": "Move-in date in Hebrew, e.g. 'מיידית' or '1 ביולי'."},
                        "tags": {"type": "array", "items": {"type": "string"}, "description": "Short tags like 'מרפסת', 'משופצת'."},
                        "description": {"type": "string", "description": "Free-form description of the apartment and area."},
                        "amenities": {"type": "array", "items": {"type": "string"}, "description": "Amenities, e.g. 'מזגן', 'חניה'."}
                    },
                    "additionalProperties": False
                },
                "next_question": {
                    "type": "string",
                    "description": "One short, friendly Hebrew question or acknowledgment. Empty string if everything is filled."
                },
                "ready": {
                    "type": "boolean",
                    "description": "True when title, address, price_min and price_max are all populated."
                }
            },
            "required": ["extracted", "next_question", "ready"],
            "additionalProperties": False
        }
    }
}


@app.route('/api/landlord/extract-property', methods=['POST'])
@require_auth
def extract_property():
    user_id = g.user_id
    data = request.get_json(silent=True) or {}
    history = data.get('messages')
    if not isinstance(history, list) or not history:
        return jsonify({'error': 'Missing messages'}), 400

    ok, err = _chat_rate_check(user_id)
    if not ok:
        return jsonify({'error': err}), 429

    safe_messages = []
    for m in history[-20:]:
        if not isinstance(m, dict):
            continue
        role = m.get('role')
        content = m.get('content', '')
        if role not in ('user', 'assistant') or not isinstance(content, str):
            continue
        safe_messages.append({'role': role, 'content': content[:CHAT_MAX_CHARS]})
    if not safe_messages:
        return jsonify({'error': 'No valid messages'}), 400

    system_msg = {
        'role': 'system',
        'content': (
            "אתה עוזר חכם של RentMate שעוזר למשכיר להוסיף דירה. דבר עברית, קצר וידידותי. "
            "אסוף בהדרגה את הפרטים: כותרת, כתובת, טווח מחיר חודשי (מינימום ומקסימום), "
            "חדרים, גודל במ\"ר, קומה, תאריך פינוי, תיאור, ותגיות/מאפיינים. "
            "בכל תגובה — קרא תמיד לכלי fill_property_form: בשדה extracted שים רק שדות שהמשתמש הזכיר במפורש; "
            "ב-next_question שאל שאלה אחת קצרה על השדה החשוב הבא שחסר; "
            "סמן ready=true רק כשכותרת, כתובת, price_min ו-price_max מולאו. "
            "אל תמציא ערכים. אם המשתמש נתן מחיר אחד (\"6500\"), הצב אותו גם ב-price_min וגם ב-price_max."
        )
    }
    messages = [system_msg] + safe_messages

    if openai_client is None:
        return jsonify({
            'extracted': {},
            'next_question': 'מצב דמו: ספרי לי על הדירה — מה הכתובת, כמה חדרים ומחיר?',
            'ready': False
        })

    try:
        response = openai_client.chat.completions.create(
            model=os.environ.get('OPENAI_MODEL', 'gpt-4o-mini'),
            messages=messages,
            tools=[PROPERTY_EXTRACTION_TOOL],
            tool_choice={'type': 'function', 'function': {'name': 'fill_property_form'}},
            timeout=_env_int('OPENAI_TIMEOUT_SECONDS', 20),
        )
    except (OpenAIError, TimeoutError, ConnectionError) as e:
        log.exception('OpenAI extraction failed: %s', e)
        return jsonify({'error': 'AI temporarily unavailable'}), 503

    choice = response.choices[0]
    tool_calls = getattr(choice.message, 'tool_calls', None) or []
    if not tool_calls:
        return jsonify({
            'extracted': {},
            'next_question': choice.message.content or 'תוכלי לפרט קצת על הדירה?',
            'ready': False
        })

    try:
        args = json.loads(tool_calls[0].function.arguments)
    except (ValueError, TypeError, AttributeError) as e:
        log.warning('Failed to parse tool arguments: %s', e)
        return jsonify({'error': 'AI returned malformed data'}), 502

    extracted = args.get('extracted') or {}
    if not isinstance(extracted, dict):
        extracted = {}

    return jsonify({
        'extracted': extracted,
        'next_question': str(args.get('next_question') or '')[:500],
        'ready': bool(args.get('ready', False))
    })
def verify_ws_token(data):
    token = data.get('token')
    if not token:
        return None
    uid, err = _load_token(token)
    if err or uid is None:
        return None
    return uid

@socketio.on('join_chat')
def handle_join_chat(data):
    user_id = verify_ws_token(data)
    if not user_id:
        emit('error', {'msg': 'Unauthorized'})
        return

    property_id = data.get('property_id')
    renter_id = data.get('renter_id')
    if not property_id or not renter_id:
        return
        
    room = f"chat_{property_id}_{renter_id}"
    join_room(room)
    
    messages = models.DirectMessage.query.filter(
        models.DirectMessage.property_id == property_id,
        db.or_(
            models.DirectMessage.sender_id == renter_id,
            models.DirectMessage.receiver_id == renter_id
        )
    ).order_by(models.DirectMessage.created_at).all()
    
    history = []
    for m in messages:
        history.append({
            'id': m.id,
            'sender_id': m.sender_id,
            'content': m.content,
            'ts': m.created_at.isoformat()
        })
        
    emit('chat_history', {'messages': history})

@socketio.on('send_message')
def handle_send_message(data):
    user_id = verify_ws_token(data)
    if not user_id:
        emit('error', {'msg': 'Unauthorized'})
        return

    property_id = data.get('property_id')
    renter_id = data.get('renter_id')
    content = data.get('content')
    
    if not property_id or not renter_id or not content:
        return
        
    prop = db.session.get(models.Property, property_id)
    if not prop:
        return
        
    receiver_id = prop.owner_id if user_id == int(renter_id) else int(renter_id)
    
    msg = models.DirectMessage(
        sender_id=user_id,
        receiver_id=receiver_id,
        property_id=property_id,
        content=content
    )
    db.session.add(msg)
    db.session.commit()
    
    room = f"chat_{property_id}_{renter_id}"
    emit('new_message', {
        'id': msg.id,
        'sender_id': msg.sender_id,
        'content': msg.content,
        'ts': msg.created_at.isoformat()
    }, to=room)


if __name__ == '__main__':
    socketio.run(app, debug=_env_bool('FLASK_DEBUG', False), port=_env_int('PORT', 5000))
