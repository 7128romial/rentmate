"""Listing CRUD — includes the step-by-step wizard, image upload, status changes."""

from datetime import datetime, date

from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash, abort
from flask_login import login_required, current_user

from app.extensions import db, limiter
from app.models import (
    Apartment, Listing, ListingImage, ListingType, ListingStatus, RoleType,
)
from app.services.cloudinary_service import upload_image
from app.services.maps_service import geocode
from app.utils.decorators import role_required
from app.utils.validators import clamp_int

bp = Blueprint("listings", __name__)


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@bp.route("/create")
@login_required
@role_required(RoleType.LANDLORD, RoleType.ROOMMATE)
def create_wizard():
    return render_template("listings/wizard.html")


@bp.route("/<int:listing_id>")
def listing_detail(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.status == ListingStatus.CLOSED:
        abort(404)
    listing.view_count = (listing.view_count or 0) + 1
    db.session.commit()
    return render_template("listings/detail.html", listing=listing)


@bp.route("/<int:listing_id>/edit")
@login_required
def listing_edit(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.publisher_id != current_user.id:
        abort(403)
    return render_template("listings/edit.html", listing=listing)


# ---------------------------------------------------------------------------
# Wizard submit endpoint
# ---------------------------------------------------------------------------

@bp.route("/api/listings", methods=["POST"])
@login_required
@role_required(RoleType.LANDLORD, RoleType.ROOMMATE)
@limiter.limit("20 per hour")
def api_create_listing():
    data = request.get_json(silent=True) or {}

    # ---- Apartment ----
    address = (data.get("address") or "").strip()
    city = (data.get("city") or "").strip()
    if not (address and city):
        return jsonify({"error": "address and city required"}), 400

    apt = Apartment(
        owner_id=current_user.id,
        address=address, city=city,
        neighborhood=(data.get("neighborhood") or "").strip() or None,
        latitude=data.get("latitude"), longitude=data.get("longitude"),
        rooms=float(data.get("rooms") or 0),
        size_sqm=clamp_int(data.get("size_sqm"), 5, 5000, None),
        floor=clamp_int(data.get("floor"), -5, 100, 0),
        has_elevator=bool(data.get("has_elevator")),
        has_parking=bool(data.get("has_parking")),
        has_balcony=bool(data.get("has_balcony")),
        is_furnished=bool(data.get("is_furnished")),
        allows_pets=bool(data.get("allows_pets")),
        allows_smoking=bool(data.get("allows_smoking")),
    )

    # Auto-geocode if coords missing
    if not (apt.latitude and apt.longitude):
        g = geocode(f"{address}, {city}")
        if g:
            apt.latitude = g["lat"]
            apt.longitude = g["lng"]

    db.session.add(apt)
    db.session.flush()

    # ---- Listing ----
    listing_type_raw = data.get("listing_type") or "whole_apartment"
    if listing_type_raw not in {t.value for t in ListingType}:
        return jsonify({"error": "invalid listing_type"}), 400

    avail = None
    if data.get("available_from"):
        try:
            avail = datetime.strptime(data["available_from"], "%Y-%m-%d").date()
        except ValueError:
            pass

    listing = Listing(
        apartment_id=apt.id,
        publisher_id=current_user.id,
        listing_type=ListingType(listing_type_raw),
        monthly_price=clamp_int(data.get("monthly_price"), 500, 1_000_000, 0),
        available_from=avail or date.today(),
        min_lease_months=clamp_int(data.get("min_lease_months"), 1, 60, 12),
        description=(data.get("description") or "").strip()[:5000],
        preferences=data.get("preferences") or {},
        status=ListingStatus.ACTIVE,
    )
    db.session.add(listing)
    db.session.commit()

    return jsonify({"ok": True, "listing_id": listing.id,
                    "redirect": url_for("listings.listing_detail", listing_id=listing.id)})


# ---------------------------------------------------------------------------
# Image upload / delete / reorder
# ---------------------------------------------------------------------------

@bp.route("/api/listings/<int:listing_id>/images", methods=["POST"])
@login_required
@limiter.limit("30 per hour")
def api_upload_image(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.publisher_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    f = request.files.get("image")
    if not f:
        return jsonify({"error": "no file"}), 400
    url = upload_image(f)
    if not url:
        return jsonify({"error": "upload failed"}), 500

    is_primary = len(listing.images) == 0
    order = len(listing.images)
    img = ListingImage(listing_id=listing.id, image_url=url,
                       display_order=order, is_primary=is_primary)
    db.session.add(img)
    db.session.commit()
    return jsonify({"id": img.id, "url": url, "is_primary": is_primary, "order": order})


@bp.route("/api/listings/images/<int:image_id>", methods=["DELETE"])
@login_required
def api_delete_image(image_id):
    img = db.session.get(ListingImage, image_id)
    if not img:
        return jsonify({"error": "not found"}), 404
    listing = db.session.get(Listing, img.listing_id)
    if not listing or listing.publisher_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    was_primary = img.is_primary
    db.session.delete(img)
    db.session.commit()
    if was_primary:
        next_img = ListingImage.query.filter_by(listing_id=listing.id).order_by(
            ListingImage.display_order.asc()
        ).first()
        if next_img:
            next_img.is_primary = True
            db.session.commit()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Status / metadata updates
# ---------------------------------------------------------------------------

@bp.route("/api/listings/<int:listing_id>/status", methods=["POST"])
@login_required
def api_set_status(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.publisher_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    new_status = (request.get_json(silent=True) or {}).get("status")
    if new_status not in {s.value for s in ListingStatus}:
        return jsonify({"error": "bad status"}), 400
    listing.status = ListingStatus(new_status)
    db.session.commit()
    return jsonify({"ok": True, "status": listing.status.value})


@bp.route("/api/listings/<int:listing_id>", methods=["PATCH"])
@login_required
def api_update_listing(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.publisher_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403
    data = request.get_json(silent=True) or {}
    for field in ("monthly_price", "min_lease_months"):
        if field in data:
            setattr(listing, field, clamp_int(data[field], 0, 1_000_000, getattr(listing, field)))
    if "description" in data:
        listing.description = (data["description"] or "").strip()[:5000]
    if "preferences" in data and isinstance(data["preferences"], dict):
        listing.preferences = data["preferences"]
    if "available_from" in data and data["available_from"]:
        try:
            listing.available_from = datetime.strptime(data["available_from"], "%Y-%m-%d").date()
        except ValueError:
            pass
    db.session.commit()
    return jsonify({"ok": True})
