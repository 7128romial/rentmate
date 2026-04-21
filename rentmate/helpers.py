"""Shared helpers used across blueprints."""

from datetime import date
from flask import url_for

ISRAELI_CITIES = [
    "תל אביב", "ירושלים", "חיפה", "באר שבע", "רמת גן", "הרצליה",
    "נתניה", "פתח תקווה", "ראשון לציון", "אשדוד", "חולון", "בת ים",
    "רחובות", "כפר סבא", "רעננה", "מודיעין", "אילת", "עכו", "נצרת",
    "טבריה",
]


def parse_date(s):
    if not s:
        return None
    try:
        return date.fromisoformat(s)
    except (ValueError, TypeError):
        return None


def _image_urls(prop):
    urls = []
    for img in prop.images:
        urls.append({
            "id": img.id,
            "url": img.image_url,
            "thumb": img.thumb_url or img.image_url,
            "is_primary": img.is_primary,
        })
    return urls


def property_to_dict(prop, score_info=None, include_landlord=False):
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
        "images": _image_urls(prop),
        "status": prop.status,
        "landlord_id": prop.landlord_id,
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
    }
    if include_landlord and prop.landlord:
        d["landlord"] = {
            "id": prop.landlord.id,
            "first_name": prop.landlord.first_name,
            "last_name": prop.landlord.last_name,
            "avatar_url": prop.landlord.avatar_url,
            "initials": prop.landlord.initials,
        }
    if score_info:
        d["match_score"] = score_info["total"]
        d["score_breakdown"] = score_info
    return d
