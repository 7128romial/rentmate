"""Swipe interface + matches data API."""

from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user

from app.extensions import db, limiter
from app.models import Listing, ListingStatus, Match, MatchAction
from app.services.matching_engine import score_listing

bp = Blueprint("matches", __name__)


@bp.route("/matches/swipe")
@login_required
def swipe():
    return render_template("swipe/deck.html")


@bp.route("/api/matches")
@login_required
def api_matches():
    """Return scored listings the user hasn't acted on yet."""
    min_score = request.args.get("min_score", type=int, default=0)
    limit = request.args.get("limit", type=int, default=30)

    already = {m.listing_id for m in Match.query.filter(
        Match.user_id == current_user.id,
        Match.user_action.in_([MatchAction.LIKED, MatchAction.PASSED]),
    ).all()}

    listings = Listing.query.filter(
        Listing.status == ListingStatus.ACTIVE,
        Listing.publisher_id != current_user.id,
    ).all()

    scored = []
    for listing in listings:
        if listing.id in already:
            continue
        breakdown = score_listing(current_user, listing)
        if breakdown["total"] < min_score:
            continue
        scored.append((listing, breakdown))

    scored.sort(key=lambda p: p[1]["total"], reverse=True)
    scored = scored[:limit]

    return jsonify({
        "items": [_serialize_match(listing, bd) for listing, bd in scored],
        "total": len(scored),
    })


@bp.route("/api/matches/action", methods=["POST"])
@login_required
@limiter.limit("120 per minute")
def api_action():
    """Record a swipe left/right / save. Body: {listing_id, action}."""
    data = request.get_json(silent=True) or {}
    listing_id = data.get("listing_id")
    action_raw = data.get("action")

    if not listing_id or action_raw not in {a.value for a in MatchAction}:
        return jsonify({"error": "bad request"}), 400

    listing = db.session.get(Listing, int(listing_id))
    if not listing or listing.status != ListingStatus.ACTIVE:
        return jsonify({"error": "listing not available"}), 404
    if listing.publisher_id == current_user.id:
        return jsonify({"error": "cannot swipe on own listing"}), 400

    breakdown = score_listing(current_user, listing)
    match = Match.query.filter_by(user_id=current_user.id, listing_id=listing.id).first()
    if not match:
        match = Match(
            user_id=current_user.id, listing_id=listing.id,
            match_score=breakdown["total"], score_breakdown=breakdown,
        )
        db.session.add(match)

    match.match_score = breakdown["total"]
    match.score_breakdown = breakdown
    match.user_action = MatchAction(action_raw)
    db.session.commit()

    # High-match notification for the listing publisher
    if action_raw == MatchAction.LIKED.value and breakdown["total"] >= 85:
        from app.services.notifications_service import notify_high_match
        notify_high_match(listing=listing, candidate=current_user, score=breakdown["total"])

    return jsonify({"ok": True, "match_score": breakdown["total"]})


def _serialize_match(listing, breakdown):
    apt = listing.apartment
    return {
        "id": listing.id,
        "title": f"{listing.apartment.rooms} חדרים ב{listing.apartment.city}" if apt else "דירה",
        "price": listing.monthly_price,
        "listing_type": listing.listing_type.value,
        "description": listing.description[:280],
        "rooms": float(apt.rooms) if apt else None,
        "size_sqm": apt.size_sqm if apt else None,
        "floor": apt.floor if apt else None,
        "city": apt.city if apt else "",
        "neighborhood": apt.neighborhood if apt else "",
        "address": apt.address if apt else "",
        "lat": float(apt.latitude) if apt and apt.latitude else None,
        "lng": float(apt.longitude) if apt and apt.longitude else None,
        "amenities": {
            "elevator": bool(apt and apt.has_elevator),
            "parking": bool(apt and apt.has_parking),
            "balcony": bool(apt and apt.has_balcony),
            "furnished": bool(apt and apt.is_furnished),
            "pets": bool(apt and apt.allows_pets),
            "smoking": bool(apt and apt.allows_smoking),
        },
        "images": [img.image_url for img in listing.images],
        "primary_image": listing.primary_image_url,
        "available_from": listing.available_from.isoformat() if listing.available_from else None,
        "match": breakdown,
        "publisher": {
            "id": listing.publisher.id,
            "first_name": listing.publisher.first_name,
            "initials": listing.publisher.initials,
            "profile_image_url": listing.publisher.profile_image_url,
        } if listing.publisher else None,
    }
