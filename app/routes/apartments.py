"""Apartment endpoints — geocode helper + landlord CRUD for the physical unit."""

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from app.extensions import db, limiter
from app.models import Apartment, RoleType
from app.utils.decorators import role_required
from app.services.maps_service import geocode

bp = Blueprint("apartments", __name__)


@bp.route("/api/geocode", methods=["POST"])
@login_required
@limiter.limit("30 per minute")
def api_geocode():
    addr = (request.get_json(silent=True) or {}).get("address", "").strip()
    if not addr or len(addr) < 3:
        return jsonify({"error": "address required"}), 400
    result = geocode(addr)
    if not result:
        return jsonify({"error": "not found"}), 404
    return jsonify(result)


@bp.route("/api/apartments", methods=["GET"])
@login_required
@role_required(RoleType.LANDLORD, RoleType.ROOMMATE)
def list_my_apartments():
    items = Apartment.query.filter_by(owner_id=current_user.id).order_by(
        Apartment.created_at.desc()
    ).all()
    return jsonify({"items": [_serialize(a) for a in items]})


def _serialize(a):
    return {
        "id": a.id,
        "address": a.address, "city": a.city, "neighborhood": a.neighborhood,
        "rooms": float(a.rooms) if a.rooms else None,
        "size_sqm": a.size_sqm, "floor": a.floor,
        "amenities": {
            "elevator": a.has_elevator, "parking": a.has_parking,
            "balcony": a.has_balcony, "furnished": a.is_furnished,
            "pets": a.allows_pets, "smoking": a.allows_smoking,
        },
    }
