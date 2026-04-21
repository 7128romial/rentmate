"""Notification center — list, mark read, register FCM token."""

from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user

from app.extensions import db
from app.models import Notification

bp = Blueprint("notifications", __name__)


@bp.route("/")
@login_required
def center():
    notifs = Notification.query.filter_by(user_id=current_user.id).order_by(
        Notification.created_at.desc()
    ).limit(100).all()
    return render_template("notifications/center.html", notifications=notifs)


@bp.route("/api/notifications")
@login_required
def api_list():
    unread_only = request.args.get("unread") == "1"
    q = Notification.query.filter_by(user_id=current_user.id)
    if unread_only:
        q = q.filter_by(is_read=False)
    items = q.order_by(Notification.created_at.desc()).limit(50).all()
    unread_count = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({
        "items": [{
            "id": n.id, "type": n.type.value, "title": n.title, "body": n.body,
            "related_entity_id": n.related_entity_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        } for n in items],
        "unread": unread_count,
    })


@bp.route("/api/notifications/<int:nid>/read", methods=["POST"])
@login_required
def api_mark_read(nid):
    n = db.session.get(Notification, nid)
    if not n or n.user_id != current_user.id:
        return jsonify({"error": "not found"}), 404
    n.is_read = True
    db.session.commit()
    return jsonify({"ok": True})


@bp.route("/api/notifications/read-all", methods=["POST"])
@login_required
def api_mark_all_read():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update({"is_read": True})
    db.session.commit()
    return jsonify({"ok": True})


@bp.route("/api/notifications/fcm-token", methods=["POST"])
@login_required
def api_register_fcm_token():
    token = (request.get_json(silent=True) or {}).get("token", "").strip()
    if not token or len(token) > 500:
        return jsonify({"error": "invalid token"}), 400
    current_user.fcm_token = token
    db.session.commit()
    return jsonify({"ok": True})
