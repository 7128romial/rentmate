"""Weighted matching engine.

Formula (spec §6 module 3):
  location_score     — 30%
  budget_score       — 25%
  lifestyle_score    — 30%
  availability_score — 15%

Total normalized to 0-100. Each sub-score is also 0-100 so the breakdown
renders nicely in the UI.
"""

from datetime import date

from app.services.maps_service import distance_km


def score_listing(user, listing):
    """Return dict: { total, location_score, budget_score, lifestyle_score, availability_score, reason }."""
    prefs = user.preferences or {}

    location = _score_location(prefs, listing)
    budget = _score_budget(prefs, listing)
    lifestyle = _score_lifestyle(prefs, listing)
    availability = _score_availability(prefs, listing)

    total = round(
        location * 0.30 +
        budget * 0.25 +
        lifestyle * 0.30 +
        availability * 0.15,
        2,
    )

    return {
        "total": total,
        "location_score": round(location, 1),
        "budget_score": round(budget, 1),
        "lifestyle_score": round(lifestyle, 1),
        "availability_score": round(availability, 1),
        "reason": _build_reason(prefs, listing, location, budget, lifestyle),
    }


# ---------------------------------------------------------------------------
# Sub-scorers — each returns 0-100
# ---------------------------------------------------------------------------

def _score_location(prefs, listing):
    apt = listing.apartment
    if not apt:
        return 50

    cities = [c.lower() for c in (prefs.get("preferred_cities") or []) if c]
    hoods = [n.lower() for n in (prefs.get("preferred_neighborhoods") or []) if n]

    if not cities and not hoods:
        return 55  # unknown preference = slightly above neutral

    apt_city = (apt.city or "").lower()
    apt_hood = (apt.neighborhood or "").lower()

    if apt_hood and apt_hood in hoods:
        return 100
    if apt_city and apt_city in cities:
        return 85

    # Maybe the user gave lat/lng — fallback to distance-based partial credit
    ref_lat = prefs.get("anchor_lat")
    ref_lng = prefs.get("anchor_lng")
    if ref_lat and ref_lng and apt.latitude and apt.longitude:
        km = distance_km((float(ref_lat), float(ref_lng)), (float(apt.latitude), float(apt.longitude)))
        if km < 1: return 90
        if km < 3: return 75
        if km < 7: return 55
        if km < 15: return 35
    return 15


def _score_budget(prefs, listing):
    low = prefs.get("budget_min")
    high = prefs.get("budget_max")
    price = listing.monthly_price

    if not high:
        return 55   # no budget set -> neutral
    if price <= high:
        # Further below max = better; price at max = 80
        if not low or price >= low:
            span = max(high - (low or 0), 1)
            ratio = (high - price) / span   # 0..1
            return round(80 + ratio * 20, 1)
        # Well below minimum — might be fishy or too cheap
        return 75
    overshoot_ratio = (price - high) / high
    if overshoot_ratio <= 0.05:
        return 65
    if overshoot_ratio <= 0.15:
        return 35
    return 5


def _score_lifestyle(prefs, listing):
    """Compare user's lifestyle prefs (from AI agent) against apartment + listing settings."""
    lifestyle = prefs.get("lifestyle") or {}
    apt = listing.apartment
    lp = listing.preferences or {}

    score = 0
    weight_total = 0

    def add(got, want, weight):
        nonlocal score, weight_total
        weight_total += weight
        if want is None:
            score += weight * 0.5   # no signal -> half-credit
        elif got == want:
            score += weight
        elif got in (None, ""):
            score += weight * 0.4

    # Smoking
    user_smoke = lifestyle.get("smoking")     # "no" / "outdoor" / "yes"
    apt_smoke = "yes" if apt and apt.allows_smoking else "no"
    add(user_smoke, apt_smoke, 30)

    # Pets
    user_pets = lifestyle.get("pets")
    apt_pets = bool(apt and apt.allows_pets)
    add(user_pets, apt_pets, 25)

    # Cleanliness — user's scale 1-5 vs listing's desired-tenant lifestyle tags
    cleanliness = lifestyle.get("cleanliness")
    if cleanliness is not None:
        clean_tag = "clean" in (lp.get("lifestyle_tags") or [])
        weight_total += 20
        if cleanliness >= 4 and clean_tag:
            score += 20
        elif cleanliness <= 2 and not clean_tag:
            score += 20
        else:
            score += 12

    # Social level — compare against "quiet"/"social" tags on the listing
    social = lifestyle.get("social_level")
    tags = lp.get("lifestyle_tags") or []
    if social:
        weight_total += 25
        if social == "quiet" and "quiet" in tags:
            score += 25
        elif social == "social" and "social" in tags:
            score += 25
        elif social == "balanced":
            score += 18
        else:
            score += 10

    if weight_total == 0:
        return 55
    return round(score / weight_total * 100, 1)


def _score_availability(prefs, listing):
    want = prefs.get("move_in_date")
    avail = listing.available_from

    if not want or not avail:
        return 60

    try:
        if isinstance(want, str):
            want = date.fromisoformat(want)
    except ValueError:
        return 60

    today = date.today()
    effective = max(avail, today)
    delta_days = abs((effective - want).days)

    if delta_days <= 7:  return 100
    if delta_days <= 21: return 80
    if delta_days <= 45: return 55
    if delta_days <= 90: return 30
    return 10


def _build_reason(prefs, listing, location, budget, lifestyle):
    """Human-readable Hebrew explanation of the top signal that drove the score."""
    winners = sorted([
        ("מיקום", location), ("מחיר", budget), ("סגנון חיים", lifestyle),
    ], key=lambda t: t[1], reverse=True)
    label, val = winners[0]
    if val >= 85:
        return f"התאמה מעולה ב{label}"
    if val >= 65:
        return f"התאמה טובה ב{label}"
    return f"התאמה חלקית ב{label}"
