"""RentMate matching algorithm.

Calculates a 0-100 match score between a user's preferences and a property.
Score breakdown:
  - Location:  30 pts  (exact city match)
  - Budget:    35 pts  (how well price fits max rent)
  - Lifestyle: 25 pts  (smoking, pets, gender compatibility)
  - Dates:     10 pts  (move-in date proximity)
"""

from datetime import date, timedelta


def calculate_match_score(user_prefs, prop):
    """Return dict with total score and per-category breakdown."""
    location = _score_location(user_prefs, prop)
    budget = _score_budget(user_prefs, prop)
    lifestyle = _score_lifestyle(user_prefs, prop)
    dates = _score_dates(user_prefs, prop)
    total = location + budget + lifestyle + dates

    return {
        "total": total,
        "location": location,
        "budget": budget,
        "lifestyle": lifestyle,
        "dates": dates,
    }


def _score_location(prefs, prop):
    """30 pts: exact city = 30, no match = 0."""
    if not prefs.preferred_city:
        return 15  # no preference set, give half
    if prefs.preferred_city.strip().lower() == prop.city.strip().lower():
        return 30
    return 0


def _score_budget(prefs, prop):
    """35 pts based on how price relates to max rent."""
    if not prefs.max_rent or prefs.max_rent <= 0:
        return 18  # no budget set
    ratio = prop.rent_price / prefs.max_rent
    if ratio <= 0.70:
        return 35
    if ratio <= 0.85:
        return 30
    if ratio <= 1.0:
        return 25
    if ratio <= 1.10:
        return 10
    return 0


def _score_lifestyle(prefs, prop):
    """25 pts: smoking + pets + gender compatibility."""
    score = 0.0

    # Smoking (10 pts of 25)
    if prefs.smoking == "no" and not prop.smoking_allowed:
        score += 10
    elif prefs.smoking == "yes" and prop.smoking_allowed:
        score += 10
    elif prefs.smoking == "outdoor":
        score += 5  # partial
    else:
        score += 3  # mismatch but not deal-breaker

    # Pets (8 pts of 25)
    if prefs.pets and prop.pets_allowed:
        score += 8
    elif not prefs.pets and not prop.pets_allowed:
        score += 8
    elif not prefs.pets:
        score += 6  # doesn't matter much
    else:
        score += 0  # has pets but not allowed

    # Gender preference (7 pts of 25) — relevant for room/roommate
    if prop.property_type == "room" and prop.roommate_gender:
        if prefs.preferred_gender == "any" or not prefs.preferred_gender:
            score += 7
        elif prefs.preferred_gender == prop.roommate_gender:
            score += 7
        else:
            score += 0
    else:
        score += 7  # not applicable

    return round(score)


def _score_dates(prefs, prop):
    """10 pts based on how soon the property is available vs move-in date."""
    if not prefs.move_in_date or not prop.available_from:
        return 5  # unknown, give half

    today = date.today()
    avail = prop.available_from
    move = prefs.move_in_date

    # Use the later of (today, available_from) as the effective date
    effective = max(avail, today)
    delta = abs((effective - move).days)

    if delta <= 7:
        return 10
    if delta <= 30:
        return 7
    if delta <= 60:
        return 4
    return 0
