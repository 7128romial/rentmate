"""RentMate — Swipe. Match. Move In.

Main Flask application with all routes.
"""

import os
import json
from datetime import datetime, date
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, jsonify, abort, session,
)
from flask_login import (
    LoginManager, login_user, logout_user,
    login_required, current_user,
)

from config import Config
from models import (
    db, bcrypt, User, UserPreferences, Property, PropertyImage,
    Favorite, Conversation, Message, Notification,
)
from matching import calculate_match_score

app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
bcrypt.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ISRAELI_CITIES = [
    "תל אביב", "ירושלים", "חיפה", "באר שבע", "רמת גן", "הרצליה",
    "נתניה", "פתח תקווה", "ראשון לציון", "אשדוד", "חולון", "בת ים",
    "רחובות", "כפר סבא", "רעננה", "מודיעין", "אילת", "עכו", "נצרת",
    "טבריה",
]


def _parse_date(s):
    """Parse ISO date string, return None on failure."""
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _property_to_dict(prop, score_info=None):
    """Serialize a Property to a JSON-friendly dict."""
    d = {
        "id": prop.id,
        "title": prop.title,
        "city": prop.city,
        "neighborhood": prop.neighborhood or "",
        "address": prop.address or "",
        "property_type": prop.property_type,
        "rooms": prop.rooms,
        "floor": prop.floor,
        "size_sqm": prop.size_sqm,
        "rent_price": prop.rent_price,
        "furnished": prop.furnished,
        "parking": prop.parking,
        "elevator": prop.elevator,
        "balcony": prop.balcony,
        "ac": prop.ac,
        "storage": prop.storage,
        "pets_allowed": prop.pets_allowed,
        "smoking_allowed": prop.smoking_allowed,
        "available_from": prop.available_from.isoformat() if prop.available_from else None,
        "min_rental_months": prop.min_rental_months,
        "description": prop.description or "",
        "primary_image": prop.primary_image,
        "status": prop.status,
        "landlord_id": prop.landlord_id,
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
    }
    if score_info:
        d["match_score"] = score_info["total"]
        d["score_breakdown"] = score_info
    return d


# ---------------------------------------------------------------------------
# Public pages
# ---------------------------------------------------------------------------

@app.route("/")
def landing():
    count = Property.query.filter_by(status="active").count()
    return render_template("landing.html", listing_count=count)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("matches"))
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        confirm = request.form.get("confirm_password", "")
        first_name = request.form.get("first_name", "").strip()
        last_name = request.form.get("last_name", "").strip()
        phone = request.form.get("phone", "").strip()
        city = request.form.get("city", "").strip()
        age = request.form.get("age", type=int)
        gender = request.form.get("gender", "").strip()
        role = request.form.get("role", "tenant").strip()

        errors = []
        if not email or "@" not in email:
            errors.append("כתובת אימייל לא תקינה")
        if len(password) < 8:
            errors.append("הסיסמה חייבת להכיל לפחות 8 תווים")
        if password != confirm:
            errors.append("הסיסמאות אינן תואמות")
        if not first_name or not last_name:
            errors.append("יש להזין שם מלא")
        if User.query.filter_by(email=email).first():
            errors.append("כתובת האימייל כבר רשומה במערכת")

        if errors:
            return render_template("register.html", errors=errors, cities=ISRAELI_CITIES)

        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            city=city,
            age=age,
            gender=gender,
            role=role,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        prefs = UserPreferences(user_id=user.id, preferred_city=city)
        db.session.add(prefs)
        db.session.commit()

        login_user(user)
        return redirect(url_for("matches"))

    return render_template("register.html", errors=[], cities=ISRAELI_CITIES)


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("matches"))
    if request.method == "POST":
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        remember = bool(request.form.get("remember"))

        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=remember)
            nxt = request.args.get("next")
            return redirect(nxt or url_for("matches"))
        return render_template("login.html", error="אימייל או סיסמה שגויים")

    return render_template("login.html", error=None)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("landing"))


# ---------------------------------------------------------------------------
# Matches / Swipe (the hero page)
# ---------------------------------------------------------------------------

@app.route("/matches")
@login_required
def matches():
    return render_template("matches.html")


@app.route("/api/matches")
@login_required
def api_matches():
    """Return scored property matches for the current user."""
    prefs = current_user.preferences
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.session.add(prefs)
        db.session.commit()

    min_score = request.args.get("min_score", 0, type=int)

    props = Property.query.filter_by(status="active").all()
    results = []
    for p in props:
        if p.landlord_id == current_user.id:
            continue
        score = calculate_match_score(prefs, p)
        if score["total"] >= min_score:
            results.append(_property_to_dict(p, score))

    results.sort(key=lambda x: x["match_score"], reverse=True)
    return jsonify(results)


@app.route("/api/matches/score/<int:property_id>")
@login_required
def api_match_score(property_id):
    """Score a single property for the current user."""
    prop = db.session.get(Property, property_id)
    if not prop:
        return jsonify({"error": "not found"}), 404
    prefs = current_user.preferences
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.session.add(prefs)
        db.session.commit()
    score = calculate_match_score(prefs, prop)
    return jsonify(score)


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------

@app.route("/properties")
def property_search():
    return render_template("search.html", cities=ISRAELI_CITIES)


@app.route("/api/properties")
def api_properties():
    """Filterable property list."""
    q = Property.query.filter_by(status="active")

    city = request.args.get("city")
    if city:
        q = q.filter_by(city=city)

    ptype = request.args.get("type")
    if ptype and ptype != "all":
        q = q.filter_by(property_type=ptype)

    min_price = request.args.get("min_price", type=int)
    max_price = request.args.get("max_price", type=int)
    if min_price:
        q = q.filter(Property.rent_price >= min_price)
    if max_price:
        q = q.filter(Property.rent_price <= max_price)

    rooms = request.args.get("rooms")
    if rooms and rooms != "all":
        q = q.filter(Property.rooms == float(rooms))

    furnished = request.args.get("furnished")
    if furnished == "true":
        q = q.filter_by(furnished=True)
    parking = request.args.get("parking")
    if parking == "true":
        q = q.filter_by(parking=True)
    elevator = request.args.get("elevator")
    if elevator == "true":
        q = q.filter_by(elevator=True)
    pets = request.args.get("pets")
    if pets == "true":
        q = q.filter_by(pets_allowed=True)

    sort = request.args.get("sort", "newest")
    if sort == "price_asc":
        q = q.order_by(Property.rent_price.asc())
    elif sort == "price_desc":
        q = q.order_by(Property.rent_price.desc())
    else:
        q = q.order_by(Property.created_at.desc())

    page = request.args.get("page", 1, type=int)
    per_page = 12
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    items = []
    for p in pagination.items:
        d = _property_to_dict(p)
        if current_user.is_authenticated:
            prefs = current_user.preferences
            if prefs:
                score = calculate_match_score(prefs, p)
                d["match_score"] = score["total"]
                d["score_breakdown"] = score
        items.append(d)

    if sort == "score" and current_user.is_authenticated:
        items.sort(key=lambda x: x.get("match_score", 0), reverse=True)

    return jsonify({
        "items": items,
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    })


@app.route("/properties/<int:property_id>")
def property_detail(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.status == "deleted":
        abort(404)
    score = None
    if current_user.is_authenticated:
        prefs = current_user.preferences
        if prefs:
            score = calculate_match_score(prefs, prop)
    is_fav = False
    if current_user.is_authenticated:
        is_fav = Favorite.query.filter_by(
            user_id=current_user.id, property_id=prop.id
        ).first() is not None
    similar = Property.query.filter(
        Property.city == prop.city,
        Property.id != prop.id,
        Property.status == "active",
    ).limit(3).all()
    return render_template(
        "property_detail.html",
        prop=prop,
        score=score,
        is_fav=is_fav,
        similar=similar,
    )


@app.route("/properties/create", methods=["GET", "POST"])
@login_required
def create_listing():
    if request.method == "POST":
        prop = Property(
            landlord_id=current_user.id,
            title=request.form.get("title", "").strip(),
            description=request.form.get("description", "").strip(),
            city=request.form.get("city", "").strip(),
            neighborhood=request.form.get("neighborhood", "").strip(),
            address=request.form.get("address", "").strip(),
            property_type=request.form.get("property_type", "apartment"),
            rooms=float(request.form.get("rooms", 0) or 0),
            floor=int(request.form.get("floor", 0) or 0),
            size_sqm=int(request.form.get("size_sqm", 0) or 0),
            rent_price=int(request.form.get("rent_price", 0) or 0),
            furnished="furnished" in request.form,
            parking="parking" in request.form,
            elevator="elevator" in request.form,
            balcony="balcony" in request.form,
            ac="ac" in request.form,
            storage="storage" in request.form,
            pets_allowed="pets_allowed" in request.form,
            smoking_allowed="smoking_allowed" in request.form,
            available_from=_parse_date(request.form.get("available_from")),
            min_rental_months=int(request.form.get("min_rental_months", 12) or 12),
            roommate_gender=request.form.get("roommate_gender"),
            max_roommates=int(request.form.get("max_roommates", 0) or 0),
        )
        db.session.add(prop)
        db.session.commit()
        return redirect(url_for("create_listing_success", property_id=prop.id))

    return render_template("create_listing.html", cities=ISRAELI_CITIES)


@app.route("/properties/create/success/<int:property_id>")
@login_required
def create_listing_success(property_id):
    return render_template("create_listing_success.html", property_id=property_id)


@app.route("/properties/<int:property_id>/edit", methods=["GET", "POST"])
@login_required
def edit_listing(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.landlord_id != current_user.id:
        abort(403)
    if request.method == "POST":
        prop.title = request.form.get("title", prop.title).strip()
        prop.description = request.form.get("description", "").strip()
        prop.city = request.form.get("city", prop.city).strip()
        prop.neighborhood = request.form.get("neighborhood", "").strip()
        prop.address = request.form.get("address", "").strip()
        prop.property_type = request.form.get("property_type", prop.property_type)
        prop.rooms = float(request.form.get("rooms", prop.rooms) or 0)
        prop.floor = int(request.form.get("floor", prop.floor) or 0)
        prop.size_sqm = int(request.form.get("size_sqm", prop.size_sqm) or 0)
        prop.rent_price = int(request.form.get("rent_price", prop.rent_price) or 0)
        prop.furnished = "furnished" in request.form
        prop.parking = "parking" in request.form
        prop.elevator = "elevator" in request.form
        prop.balcony = "balcony" in request.form
        prop.ac = "ac" in request.form
        prop.storage = "storage" in request.form
        prop.pets_allowed = "pets_allowed" in request.form
        prop.smoking_allowed = "smoking_allowed" in request.form
        prop.available_from = _parse_date(request.form.get("available_from"))
        prop.min_rental_months = int(request.form.get("min_rental_months", 12) or 12)
        db.session.commit()
        return redirect(url_for("property_detail", property_id=prop.id))
    return render_template("edit_listing.html", prop=prop, cities=ISRAELI_CITIES)


@app.route("/api/properties/<int:property_id>/delete", methods=["POST"])
@login_required
def delete_listing(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.landlord_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    prop.status = "deleted"
    db.session.commit()
    return jsonify({"ok": True})


@app.route("/api/properties/<int:property_id>/toggle-status", methods=["POST"])
@login_required
def toggle_listing_status(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.landlord_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    prop.status = "paused" if prop.status == "active" else "active"
    db.session.commit()
    return jsonify({"status": prop.status})


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

@app.route("/api/favorites/toggle", methods=["POST"])
@login_required
def toggle_favorite():
    data = request.get_json(silent=True) or {}
    pid = data.get("property_id")
    if not pid:
        return jsonify({"error": "missing property_id"}), 400
    fav = Favorite.query.filter_by(user_id=current_user.id, property_id=pid).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
        return jsonify({"favorited": False})
    else:
        db.session.add(Favorite(user_id=current_user.id, property_id=pid))
        db.session.commit()
        return jsonify({"favorited": True})


# ---------------------------------------------------------------------------
# Profile & Preferences
# ---------------------------------------------------------------------------

@app.route("/profile", methods=["GET"])
@login_required
def profile():
    my_listings = Property.query.filter(
        Property.landlord_id == current_user.id,
        Property.status != "deleted",
    ).order_by(Property.created_at.desc()).all()
    return render_template("profile.html", cities=ISRAELI_CITIES, my_listings=my_listings)


@app.route("/api/profile", methods=["PUT"])
@login_required
def api_update_profile():
    data = request.get_json(silent=True) or {}
    tab = data.get("tab", "personal")

    if tab == "personal":
        current_user.first_name = data.get("first_name", current_user.first_name)
        current_user.last_name = data.get("last_name", current_user.last_name)
        current_user.phone = data.get("phone", current_user.phone)
        current_user.city = data.get("city", current_user.city)
        current_user.age = data.get("age", current_user.age)
        current_user.gender = data.get("gender", current_user.gender)

    elif tab == "housing":
        prefs = current_user.preferences
        if not prefs:
            prefs = UserPreferences(user_id=current_user.id)
            db.session.add(prefs)
        prefs.preferred_city = data.get("preferred_city", prefs.preferred_city)
        prefs.max_rent = data.get("max_rent", prefs.max_rent)
        prefs.move_in_date = _parse_date(data.get("move_in_date"))
        prefs.min_rental_months = data.get("min_rental_months", prefs.min_rental_months)
        prefs.preferred_property_type = data.get("preferred_property_type", prefs.preferred_property_type)

    elif tab == "lifestyle":
        prefs = current_user.preferences
        if not prefs:
            prefs = UserPreferences(user_id=current_user.id)
            db.session.add(prefs)
        prefs.smoking = data.get("smoking", prefs.smoking)
        prefs.pets = data.get("pets", prefs.pets)
        prefs.cleanliness_level = data.get("cleanliness_level", prefs.cleanliness_level)
        prefs.noise_level = data.get("noise_level", prefs.noise_level)
        prefs.sleep_schedule = data.get("sleep_schedule", prefs.sleep_schedule)
        prefs.preferred_gender = data.get("preferred_gender", prefs.preferred_gender)
        prefs.roommate_age_min = data.get("roommate_age_min", prefs.roommate_age_min)
        prefs.roommate_age_max = data.get("roommate_age_max", prefs.roommate_age_max)

    db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Chat / Messaging
# ---------------------------------------------------------------------------

@app.route("/chat")
@login_required
def chat():
    convs = Conversation.query.filter(
        db.or_(
            Conversation.user1_id == current_user.id,
            Conversation.user2_id == current_user.id,
        )
    ).order_by(Conversation.created_at.desc()).all()

    conv_list = []
    for c in convs:
        other = c.user2 if c.user1_id == current_user.id else c.user1
        last_msg = Message.query.filter_by(conversation_id=c.id).order_by(Message.created_at.desc()).first()
        unread = Message.query.filter(
            Message.conversation_id == c.id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        ).count()
        conv_list.append({
            "id": c.id,
            "other": other,
            "property": c.prop,
            "last_msg": last_msg,
            "unread": unread,
        })

    active_id = request.args.get("conv", type=int)
    active_conv = None
    messages = []
    if active_id:
        active_conv_obj = db.session.get(Conversation, active_id)
        if active_conv_obj and (active_conv_obj.user1_id == current_user.id or active_conv_obj.user2_id == current_user.id):
            active_conv = active_conv_obj
            messages = Message.query.filter_by(conversation_id=active_id).order_by(Message.created_at.asc()).all()
            # Mark as read
            Message.query.filter(
                Message.conversation_id == active_id,
                Message.sender_id != current_user.id,
                Message.is_read == False,
            ).update({"is_read": True})
            db.session.commit()

    return render_template(
        "chat.html",
        conv_list=conv_list,
        active_conv=active_conv,
        messages=messages,
    )


@app.route("/api/chat/start/<int:other_user_id>", methods=["POST"])
@login_required
def start_chat(other_user_id):
    if other_user_id == current_user.id:
        return jsonify({"error": "cannot chat with yourself"}), 400

    property_id = request.get_json(silent=True) or {}
    property_id = property_id.get("property_id")

    # Check for existing conversation
    conv = Conversation.query.filter(
        db.or_(
            db.and_(Conversation.user1_id == current_user.id, Conversation.user2_id == other_user_id),
            db.and_(Conversation.user1_id == other_user_id, Conversation.user2_id == current_user.id),
        )
    ).first()

    if not conv:
        conv = Conversation(
            user1_id=current_user.id,
            user2_id=other_user_id,
            property_id=property_id,
        )
        db.session.add(conv)
        db.session.commit()

    return jsonify({"conversation_id": conv.id})


@app.route("/api/chat/<int:conv_id>/send", methods=["POST"])
@login_required
def send_message(conv_id):
    conv = db.session.get(Conversation, conv_id)
    if not conv or (conv.user1_id != current_user.id and conv.user2_id != current_user.id):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    body = data.get("body", "").strip()
    if not body:
        return jsonify({"error": "empty message"}), 400

    msg = Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        body=body,
    )
    db.session.add(msg)
    db.session.commit()

    return jsonify({
        "id": msg.id,
        "body": msg.body,
        "sender_id": msg.sender_id,
        "created_at": msg.created_at.isoformat(),
    })


@app.route("/api/chat/<int:conv_id>/messages")
@login_required
def get_messages(conv_id):
    conv = db.session.get(Conversation, conv_id)
    if not conv or (conv.user1_id != current_user.id and conv.user2_id != current_user.id):
        return jsonify({"error": "forbidden"}), 403

    msgs = Message.query.filter_by(conversation_id=conv_id).order_by(Message.created_at.asc()).all()
    return jsonify([{
        "id": m.id,
        "body": m.body,
        "sender_id": m.sender_id,
        "created_at": m.created_at.isoformat(),
    } for m in msgs])


# ---------------------------------------------------------------------------
# DB init + seed
# ---------------------------------------------------------------------------

def seed_data():
    """Create sample data if the database is empty."""
    if User.query.first():
        return

    # Landlords
    landlord1 = User(email="david@example.com", first_name="דוד", last_name="כהן",
                     phone="050-1234567", age=45, gender="male", city="תל אביב", role="landlord")
    landlord1.set_password("password123")

    landlord2 = User(email="sara@example.com", first_name="שרה", last_name="לוי",
                     phone="050-7654321", age=38, gender="female", city="ירושלים", role="landlord")
    landlord2.set_password("password123")

    landlord3 = User(email="moshe@example.com", first_name="משה", last_name="אברהם",
                     phone="052-9876543", age=50, gender="male", city="חיפה", role="landlord")
    landlord3.set_password("password123")

    # Tenants
    tenant1 = User(email="yael@example.com", first_name="יעל", last_name="ישראלי",
                   phone="054-1112222", age=26, gender="female", city="תל אביב", role="tenant")
    tenant1.set_password("password123")

    tenant2 = User(email="omer@example.com", first_name="עומר", last_name="דהן",
                   phone="053-3334444", age=29, gender="male", city="תל אביב", role="roommate")
    tenant2.set_password("password123")

    db.session.add_all([landlord1, landlord2, landlord3, tenant1, tenant2])
    db.session.flush()

    # Preferences for tenants
    prefs1 = UserPreferences(
        user_id=tenant1.id, preferred_city="תל אביב", max_rent=6000,
        smoking="no", pets=False, move_in_date=date(2026, 4, 1),
        cleanliness_level=4, noise_level="moderate", sleep_schedule="normal",
        preferred_gender="any",
    )
    prefs2 = UserPreferences(
        user_id=tenant2.id, preferred_city="תל אביב", max_rent=4000,
        smoking="outdoor", pets=True, move_in_date=date(2026, 3, 15),
        cleanliness_level=3, noise_level="social", sleep_schedule="night",
        preferred_gender="male",
    )
    db.session.add_all([prefs1, prefs2])

    # Properties
    properties_data = [
        dict(landlord_id=landlord1.id, title="דירת 3 חדרים מרווחת בלב תל אביב",
             description="דירה מרווחת ומוארת עם מרפסת שמש, קרובה לים ולתחבורה ציבורית. מתאימה לזוג או שותפים.",
             city="תל אביב", neighborhood="הצפון הישן", address="רחוב דיזנגוף 120",
             property_type="apartment", rooms=3, floor=4, size_sqm=85,
             rent_price=5500, furnished=True, parking=False, elevator=True,
             balcony=True, ac=True, storage=False, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 4, 1), min_rental_months=12),
        dict(landlord_id=landlord1.id, title="סטודיו מעוצב ליד רוטשילד",
             description="סטודיו קטן ומעוצב, מושלם לסטודנט או עובד צעיר. ממוקם במרכז העיר.",
             city="תל אביב", neighborhood="לב העיר", address="רחוב רוטשילד 50",
             property_type="studio", rooms=1, floor=2, size_sqm=35,
             rent_price=4200, furnished=True, parking=False, elevator=False,
             balcony=False, ac=True, storage=False, pets_allowed=True,
             smoking_allowed=False, available_from=date(2026, 3, 15), min_rental_months=6),
        dict(landlord_id=landlord2.id, title="דירת 4 חדרים בבקעה ירושלים",
             description="דירה משפחתית רחבת ידיים עם נוף לחומות העיר העתיקה. שכונה שקטה וירוקה.",
             city="ירושלים", neighborhood="בקעה", address="רחוב רחל אמנו 15",
             property_type="apartment", rooms=4, floor=1, size_sqm=110,
             rent_price=4800, furnished=False, parking=True, elevator=False,
             balcony=True, ac=True, storage=True, pets_allowed=True,
             smoking_allowed=False, available_from=date(2026, 3, 20), min_rental_months=12),
        dict(landlord_id=landlord2.id, title="חדר בדירת שותפים ברחביה",
             description="חדר גדול ומרוהט בדירת 4 חדרים. 2 שותפים נוספים, אווירה נעימה.",
             city="ירושלים", neighborhood="רחביה", address="רחוב עזה 30",
             property_type="room", rooms=1, floor=3, size_sqm=18,
             rent_price=2200, furnished=True, parking=False, elevator=True,
             balcony=False, ac=True, storage=False, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 3, 10), min_rental_months=6,
             roommate_gender="female", max_roommates=3),
        dict(landlord_id=landlord3.id, title="דירת גן 3 חדרים בכרמל",
             description="דירת גן עם גינה פרטית ענקית. שכונה שקטה, מתאימה למשפחה עם חיות מחמד.",
             city="חיפה", neighborhood="כרמל מרכזי", address="רחוב הנשיא 45",
             property_type="apartment", rooms=3, floor=0, size_sqm=90,
             rent_price=3800, furnished=False, parking=True, elevator=False,
             balcony=True, ac=True, storage=True, pets_allowed=True,
             smoking_allowed=True, available_from=date(2026, 4, 15), min_rental_months=12),
        dict(landlord_id=landlord3.id, title="פנטהאוז מפואר בחיפה עם נוף לים",
             description="פנטהאוז 5 חדרים עם מרפסת ענקית ונוף פנורמי לים. מרוהט באופן מלא.",
             city="חיפה", neighborhood="כרמל צרפתי", address="שדרות הנשיא 100",
             property_type="apartment", rooms=5, floor=12, size_sqm=160,
             rent_price=8500, furnished=True, parking=True, elevator=True,
             balcony=True, ac=True, storage=True, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 5, 1), min_rental_months=12),
        dict(landlord_id=landlord1.id, title="דירת 2 חדרים בפלורנטין",
             description="דירה צעירה ואנרגטית בלב פלורנטין, צמודה לברים ומסעדות.",
             city="תל אביב", neighborhood="פלורנטין", address="רחוב ויטל 8",
             property_type="apartment", rooms=2, floor=3, size_sqm=55,
             rent_price=4800, furnished=True, parking=False, elevator=False,
             balcony=True, ac=True, storage=False, pets_allowed=True,
             smoking_allowed=True, available_from=date(2026, 3, 25), min_rental_months=12),
        dict(landlord_id=landlord2.id, title="בית פרטי בראשון לציון",
             description="בית פרטי עם חצר, 4 חדרים, מתאים למשפחה. אזור שקט ונגיש.",
             city="ראשון לציון", neighborhood="נווה הדרים", address="רחוב הדקלים 22",
             property_type="house", rooms=4, floor=0, size_sqm=140,
             rent_price=6500, furnished=False, parking=True, elevator=False,
             balcony=False, ac=True, storage=True, pets_allowed=True,
             smoking_allowed=False, available_from=date(2026, 4, 10), min_rental_months=12),
        dict(landlord_id=landlord3.id, title="חדר בשותפות ברמת גן",
             description="חדר מרוהט בדירת 3 חדרים ליד הבורסה. שותף אחד נוסף, שקט ומסודר.",
             city="רמת גן", neighborhood="בורסה", address="רחוב ז'בוטינסקי 60",
             property_type="room", rooms=1, floor=8, size_sqm=15,
             rent_price=2800, furnished=True, parking=True, elevator=True,
             balcony=False, ac=True, storage=False, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 3, 15), min_rental_months=6,
             roommate_gender="male", max_roommates=2),
        dict(landlord_id=landlord1.id, title="דירת 3.5 חדרים בנווה שאנן תל אביב",
             description="דירה מרווחת ושקטה, מושלמת לזוג. קרובה לפארק וולפסון.",
             city="תל אביב", neighborhood="נווה שאנן", address="רחוב שלמה המלך 35",
             property_type="apartment", rooms=3.5, floor=5, size_sqm=95,
             rent_price=5200, furnished=False, parking=True, elevator=True,
             balcony=True, ac=True, storage=True, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 4, 1), min_rental_months=12),
    ]

    for pdata in properties_data:
        db.session.add(Property(**pdata))

    db.session.commit()


with app.app_context():
    db.create_all()
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    seed_data()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
