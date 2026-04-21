"""Google Maps geocoding + distance — used during listing creation.

With no key set, returns None and the form degrades gracefully to a plain
address input without autocomplete or distance filtering.
"""

import logging

from flask import current_app

logger = logging.getLogger(__name__)


def _client():
    key = current_app.config.get("GOOGLE_MAPS_API_KEY")
    if not key:
        return None
    try:
        import googlemaps
    except ImportError:
        logger.warning("googlemaps package not installed — server-side geocoding disabled")
        return None
    return googlemaps.Client(key=key)


def geocode(address):
    """Return (lat, lng, formatted_address, city, neighborhood) or None."""
    client = _client()
    if client is None:
        return None
    try:
        results = client.geocode(address, region="il", language="iw")
    except Exception:
        logger.exception("geocode failed")
        return None
    if not results:
        return None
    r = results[0]
    loc = r["geometry"]["location"]
    components = {c["types"][0]: c["long_name"] for c in r.get("address_components", []) if c.get("types")}
    return {
        "lat": loc["lat"],
        "lng": loc["lng"],
        "formatted_address": r.get("formatted_address"),
        "city": components.get("locality") or components.get("administrative_area_level_2"),
        "neighborhood": components.get("neighborhood") or components.get("sublocality"),
    }


def distance_km(origin_lat_lng, dest_lat_lng):
    """Haversine fallback when no key is available."""
    from math import radians, sin, cos, atan2, sqrt
    lat1, lng1 = origin_lat_lng
    lat2, lng2 = dest_lat_lng
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c
