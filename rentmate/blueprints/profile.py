"""Profile page + preference updates."""

from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user

from rentmate.extensions import db
from rentmate.helpers import ISRAELI_CITIES, parse_date
from models import Property, UserPreferences

bp = Blueprint("profile", __name__)


@bp.route("/profile", methods=["GET"])
@login_required
def profile():
    my_listings = Property.query.filter(
        Property.landlord_id == current_user.id,
        Property.status != "deleted",
    ).order_by(Property.created_at.desc()).all()
    return render_template("profile.html", cities=ISRAELI_CITIES, my_listings=my_listings)


@bp.route("/api/profile", methods=["PUT"])
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
        prefs.move_in_date = parse_date(data.get("move_in_date"))
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
