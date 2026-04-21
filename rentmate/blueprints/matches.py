"""Swipe / matches page + scoring API."""

from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user

from rentmate.extensions import db
from rentmate.helpers import property_to_dict
from matching import calculate_match_score
from models import Property, UserPreferences

bp = Blueprint("matches", __name__)


@bp.route("/matches")
@login_required
def matches():
    return render_template("matches.html")


@bp.route("/api/matches")
@login_required
def api_matches():
    prefs = current_user.preferences
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.session.add(prefs)
        db.session.commit()

    min_score = request.args.get("min_score", 0, type=int)
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(50, request.args.get("per_page", 25, type=int))

    props = Property.query.filter_by(status="active").all()
    results = []
    for p in props:
        if p.landlord_id == current_user.id:
            continue
        score = calculate_match_score(prefs, p)
        if score["total"] >= min_score:
            results.append(property_to_dict(p, score, include_landlord=True))
    results.sort(key=lambda x: x["match_score"], reverse=True)

    start = (page - 1) * per_page
    end = start + per_page
    return jsonify({
        "items": results[start:end],
        "page": page,
        "per_page": per_page,
        "total": len(results),
        "pages": max(1, (len(results) + per_page - 1) // per_page),
    })


@bp.route("/api/matches/score/<int:property_id>")
@login_required
def api_match_score(property_id):
    prop = db.session.get(Property, property_id)
    if not prop:
        return jsonify({"error": "not found"}), 404
    prefs = current_user.preferences
    if not prefs:
        prefs = UserPreferences(user_id=current_user.id)
        db.session.add(prefs)
        db.session.commit()
    return jsonify(calculate_match_score(prefs, prop))
