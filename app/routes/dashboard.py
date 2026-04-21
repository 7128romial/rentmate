"""Landlord dashboard — analytics + candidate management."""

from sqlalchemy import func

from flask import Blueprint, render_template, request, jsonify, abort
from flask_login import login_required, current_user

from app.extensions import db
from app.models import Listing, ListingStatus, Match, MatchAction, User, RoleType
from app.utils.decorators import role_required

bp = Blueprint("dashboard", __name__)


@bp.route("/landlord")
@login_required
@role_required(RoleType.LANDLORD, RoleType.ROOMMATE)
def landlord():
    my_listings = Listing.query.filter_by(publisher_id=current_user.id).order_by(
        Listing.created_at.desc()
    ).all()

    total_views = sum(l.view_count or 0 for l in my_listings)
    total_likes = Match.query.join(Listing, Match.listing_id == Listing.id).filter(
        Listing.publisher_id == current_user.id,
        Match.user_action == MatchAction.LIKED,
    ).count()
    avg_score = db.session.query(func.avg(Match.match_score)).join(
        Listing, Match.listing_id == Listing.id
    ).filter(Listing.publisher_id == current_user.id).scalar() or 0

    return render_template(
        "dashboard/landlord.html",
        listings=my_listings,
        total_views=total_views,
        total_likes=total_likes,
        avg_score=round(float(avg_score), 1),
    )


@bp.route("/api/candidates/<int:listing_id>")
@login_required
def api_candidates(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.publisher_id != current_user.id:
        abort(403)

    matches = Match.query.filter(
        Match.listing_id == listing_id,
        Match.user_action.in_([MatchAction.LIKED, MatchAction.SAVED]),
    ).order_by(Match.match_score.desc()).all()

    return jsonify({
        "items": [{
            "match_id": m.id,
            "user": {
                "id": m.user.id,
                "first_name": m.user.first_name,
                "last_name": m.user.last_name,
                "initials": m.user.initials,
                "bio": m.user.bio,
                "profile_image_url": m.user.profile_image_url,
            },
            "match_score": float(m.match_score),
            "breakdown": m.score_breakdown,
            "created_at": m.created_at.isoformat(),
        } for m in matches],
    })


@bp.route("/api/analytics/<int:listing_id>")
@login_required
def api_analytics(listing_id):
    listing = db.session.get(Listing, listing_id)
    if not listing or listing.publisher_id != current_user.id:
        abort(403)

    likes = Match.query.filter_by(
        listing_id=listing_id, user_action=MatchAction.LIKED
    ).count()
    passes = Match.query.filter_by(
        listing_id=listing_id, user_action=MatchAction.PASSED
    ).count()
    avg_score = db.session.query(func.avg(Match.match_score)).filter_by(
        listing_id=listing_id
    ).scalar() or 0

    # Scores bucketed 0-100 in 10-point bins for a histogram
    buckets = [0] * 10
    all_scores = [float(r.match_score) for r in Match.query.filter_by(listing_id=listing_id).all()]
    for s in all_scores:
        idx = min(9, int(s // 10))
        buckets[idx] += 1

    return jsonify({
        "views": listing.view_count,
        "likes": likes,
        "passes": passes,
        "avg_score": round(float(avg_score), 1),
        "score_histogram": buckets,
    })
