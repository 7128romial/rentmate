"""Property search, detail, create/edit, favorites."""

from flask import Blueprint, render_template, request, jsonify, redirect, url_for, abort
from flask_login import login_required, current_user
from pydantic import ValidationError

from rentmate.extensions import db, limiter
from rentmate.helpers import ISRAELI_CITIES, parse_date, property_to_dict
from rentmate.schemas import PropertyCreateIn
from rentmate.services.matching_events import detect_mutual_match
from matching import calculate_match_score
from models import Property, Favorite

bp = Blueprint("properties", __name__)


@bp.route("/properties")
def property_search():
    return render_template("search.html", cities=ISRAELI_CITIES)


@bp.route("/api/properties")
def api_properties():
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
        try:
            q = q.filter(Property.rooms == float(rooms))
        except ValueError:
            pass

    for flag in ("furnished", "parking", "elevator", "pets_allowed"):
        val = request.args.get(flag if flag != "pets_allowed" else "pets")
        if val == "true":
            q = q.filter(getattr(Property, flag) == True)  # noqa: E712

    sort = request.args.get("sort", "newest")
    if sort == "price_asc":
        q = q.order_by(Property.rent_price.asc())
    elif sort == "price_desc":
        q = q.order_by(Property.rent_price.desc())
    else:
        q = q.order_by(Property.created_at.desc())

    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(50, request.args.get("per_page", 12, type=int))
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    items = []
    for p in pagination.items:
        d = property_to_dict(p, include_landlord=True)
        if current_user.is_authenticated and current_user.preferences:
            score = calculate_match_score(current_user.preferences, p)
            d["match_score"] = score["total"]
            d["score_breakdown"] = score
        items.append(d)

    if sort == "score" and current_user.is_authenticated:
        items.sort(key=lambda x: x.get("match_score", 0), reverse=True)

    return jsonify({
        "items": items,
        "page": pagination.page,
        "pages": pagination.pages,
        "per_page": per_page,
        "total": pagination.total,
    })


@bp.route("/properties/<int:property_id>")
def property_detail(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.status == "deleted":
        abort(404)
    score = None
    is_fav = False
    if current_user.is_authenticated:
        if current_user.preferences:
            score = calculate_match_score(current_user.preferences, prop)
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
        prop=prop, score=score, is_fav=is_fav, similar=similar,
    )


@bp.route("/properties/create", methods=["GET", "POST"])
@login_required
def create_listing():
    if request.method == "POST":
        try:
            data = PropertyCreateIn(
                title=request.form.get("title", "").strip(),
                description=request.form.get("description", "").strip() or None,
                city=request.form.get("city", "").strip(),
                neighborhood=request.form.get("neighborhood", "").strip() or None,
                address=request.form.get("address", "").strip() or None,
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
                available_from=parse_date(request.form.get("available_from")),
                min_rental_months=int(request.form.get("min_rental_months", 12) or 12),
                roommate_gender=request.form.get("roommate_gender") or None,
                max_roommates=int(request.form.get("max_roommates", 0) or 0) or None,
            )
        except (ValidationError, ValueError) as e:
            return render_template(
                "create_listing.html",
                cities=ISRAELI_CITIES,
                errors=[str(e)],
            )

        prop = Property(landlord_id=current_user.id, **data.model_dump())
        db.session.add(prop)
        db.session.commit()
        return redirect(url_for("properties.create_listing_success", property_id=prop.id))

    return render_template("create_listing.html", cities=ISRAELI_CITIES)


@bp.route("/properties/create/success/<int:property_id>")
@login_required
def create_listing_success(property_id):
    return render_template("create_listing_success.html", property_id=property_id)


@bp.route("/properties/<int:property_id>/edit", methods=["GET", "POST"])
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
        prop.available_from = parse_date(request.form.get("available_from"))
        prop.min_rental_months = int(request.form.get("min_rental_months", 12) or 12)
        db.session.commit()
        return redirect(url_for("properties.property_detail", property_id=prop.id))
    return render_template("edit_listing.html", prop=prop, cities=ISRAELI_CITIES)


@bp.route("/api/properties/<int:property_id>/delete", methods=["POST"])
@login_required
def delete_listing(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.landlord_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    prop.status = "deleted"
    db.session.commit()
    return jsonify({"ok": True})


@bp.route("/api/properties/<int:property_id>/toggle-status", methods=["POST"])
@login_required
def toggle_listing_status(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.landlord_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    prop.status = "paused" if prop.status == "active" else "active"
    db.session.commit()
    return jsonify({"status": prop.status})


@bp.route("/api/favorites/toggle", methods=["POST"])
@login_required
@limiter.limit("60 per minute")
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

    db.session.add(Favorite(user_id=current_user.id, property_id=pid))
    db.session.commit()

    # After a new "like", check for mutual match
    match = detect_mutual_match(current_user, pid)
    resp = {"favorited": True}
    if match:
        resp["match"] = {"id": match.id, "property_id": pid}
    return jsonify(resp)
