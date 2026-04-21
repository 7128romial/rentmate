"""Notification list + mark-as-read endpoints."""

from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

from rentmate.extensions import db
from rentmate.services.notifications import serialize_notification
from models import Notification

bp = Blueprint("notifications", __name__)


@bp.route("/api/notifications")
@login_required
def list_notifications():
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, request.args.get("per_page", 20, type=int))
    q = Notification.query.filter_by(user_id=current_user.id).order_by(
        Notification.created_at.desc()
    )
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)
    unread = Notification.query.filter_by(user_id=current_user.id, is_read=False).count()
    return jsonify({
        "items": [serialize_notification(n) for n in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
        "unread": unread,
    })


@bp.route("/api/notifications/<int:nid>/read", methods=["POST"])
@login_required
def mark_read(nid):
    n = db.session.get(Notification, nid)
    if not n or n.user_id != current_user.id:
        return jsonify({"error": "not found"}), 404
    n.is_read = True
    db.session.commit()
    return jsonify({"ok": True})


@bp.route("/api/notifications/read-all", methods=["POST"])
@login_required
def mark_all_read():
    Notification.query.filter_by(user_id=current_user.id, is_read=False).update(
        {"is_read": True}
    )
    db.session.commit()
    return jsonify({"ok": True})
