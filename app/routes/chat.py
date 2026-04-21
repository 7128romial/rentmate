"""Chat — MySQL archive + Firestore realtime dual-write."""

from datetime import datetime

from flask import Blueprint, render_template, request, jsonify, abort
from flask_login import login_required, current_user
from sqlalchemy import or_, and_, func

from app.extensions import db, limiter
from app.models import Conversation, Message, Listing
from app.services.firebase_service import (
    write_message_to_firestore, set_typing_status, firestore_available,
)
from app.services.notifications_service import notify_new_message

bp = Blueprint("chat", __name__)


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@bp.route("/")
@login_required
def inbox():
    conv_id = request.args.get("conv", type=int)
    conversations = Conversation.query.filter(
        or_(Conversation.initiator_id == current_user.id,
            Conversation.recipient_id == current_user.id)
    ).order_by(Conversation.last_message_at.desc()).all()

    active = db.session.get(Conversation, conv_id) if conv_id else None
    if active and active.initiator_id != current_user.id and active.recipient_id != current_user.id:
        active = None

    return render_template("chat/inbox.html",
                           conversations=conversations, active=active,
                           firestore_available=firestore_available())


# ---------------------------------------------------------------------------
# Start a conversation (from listing detail -> "contact publisher")
# ---------------------------------------------------------------------------

@bp.route("/api/conversations/start", methods=["POST"])
@login_required
@limiter.limit("20 per minute")
def api_start_conversation():
    data = request.get_json(silent=True) or {}
    listing_id = data.get("listing_id")
    if not listing_id:
        return jsonify({"error": "listing_id required"}), 400
    listing = db.session.get(Listing, int(listing_id))
    if not listing:
        return jsonify({"error": "listing not found"}), 404
    if listing.publisher_id == current_user.id:
        return jsonify({"error": "cannot message yourself"}), 400

    conv = Conversation.query.filter(
        Conversation.listing_id == listing.id,
        or_(
            and_(Conversation.initiator_id == current_user.id,
                 Conversation.recipient_id == listing.publisher_id),
            and_(Conversation.initiator_id == listing.publisher_id,
                 Conversation.recipient_id == current_user.id),
        ),
    ).first()

    if not conv:
        conv = Conversation(
            listing_id=listing.id,
            initiator_id=current_user.id,
            recipient_id=listing.publisher_id,
        )
        db.session.add(conv)
        db.session.commit()

    return jsonify({
        "conversation_id": conv.id,
        "redirect": f"/chat?conv={conv.id}",
    })


# ---------------------------------------------------------------------------
# Messaging API
# ---------------------------------------------------------------------------

@bp.route("/api/conversations/<int:conv_id>/messages", methods=["GET"])
@login_required
def api_get_messages(conv_id):
    conv = _require_conversation(conv_id)
    limit = request.args.get("limit", default=100, type=int)
    msgs = Message.query.filter_by(conversation_id=conv_id).order_by(
        Message.created_at.asc()
    ).limit(limit).all()

    # Mark inbound as read
    Message.query.filter(
        Message.conversation_id == conv_id,
        Message.sender_id != current_user.id,
        Message.is_read == False,  # noqa: E712
    ).update({"is_read": True})
    db.session.commit()

    return jsonify({"items": [_serialize_msg(m) for m in msgs]})


@bp.route("/api/conversations/<int:conv_id>/messages", methods=["POST"])
@login_required
@limiter.limit("30 per minute")
def api_send_message(conv_id):
    conv = _require_conversation(conv_id)
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"error": "empty"}), 400
    if len(content) > 5000:
        return jsonify({"error": "too long"}), 400

    msg = Message(
        conversation_id=conv_id, sender_id=current_user.id,
        content=content, created_at=datetime.utcnow(),
    )
    db.session.add(msg)
    conv.last_message_at = msg.created_at
    db.session.flush()

    # Dual-write to Firestore for realtime delivery to the other participant.
    fs_id = write_message_to_firestore(conv.id, {
        "id": msg.id,
        "sender_id": current_user.id,
        "content": content,
        "created_at": msg.created_at.isoformat(),
        "is_read": False,
    })
    if fs_id:
        msg.firebase_message_id = fs_id
    db.session.commit()

    # Out-of-band: push + in-app notification for the recipient
    other_id = conv.recipient_id if conv.initiator_id == current_user.id else conv.initiator_id
    notify_new_message(recipient_id=other_id, sender=current_user,
                       conversation_id=conv.id, preview=content[:140])

    return jsonify(_serialize_msg(msg))


@bp.route("/api/conversations/<int:conv_id>/typing", methods=["POST"])
@login_required
@limiter.limit("120 per minute")
def api_typing(conv_id):
    conv = _require_conversation(conv_id)
    is_typing = bool((request.get_json(silent=True) or {}).get("typing"))
    set_typing_status(conv.id, current_user.id, is_typing)
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_conversation(conv_id):
    conv = db.session.get(Conversation, conv_id)
    if not conv or (conv.initiator_id != current_user.id and conv.recipient_id != current_user.id):
        abort(403)
    return conv


def _serialize_msg(m):
    return {
        "id": m.id,
        "sender_id": m.sender_id,
        "content": m.content,
        "is_read": m.is_read,
        "created_at": m.created_at.isoformat(),
    }
