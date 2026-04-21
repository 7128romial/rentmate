"""Chat HTTP endpoints — Socket.IO handles live delivery separately."""

from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from pydantic import ValidationError

from rentmate.extensions import db, limiter
from rentmate.schemas import MessageIn
from rentmate.services.chat import (
    get_conversation_for_user,
    create_message,
    mark_conversation_read,
    serialize_message,
)
from rentmate.services.notifications import create_notification
from models import Conversation, Message

bp = Blueprint("chat", __name__)


@bp.route("/chat")
@login_required
def chat():
    convs = Conversation.query.filter(
        db.or_(
            Conversation.user1_id == current_user.id,
            Conversation.user2_id == current_user.id,
        )
    ).order_by(Conversation.created_at.desc()).all()

    conv_list = []
    for c in convs:
        other = c.user2 if c.user1_id == current_user.id else c.user1
        last_msg = Message.query.filter_by(conversation_id=c.id).order_by(Message.created_at.desc()).first()
        unread = Message.query.filter(
            Message.conversation_id == c.id,
            Message.sender_id != current_user.id,
            Message.is_read == False,  # noqa: E712
        ).count()
        conv_list.append({
            "id": c.id, "other": other, "property": c.prop,
            "last_msg": last_msg, "unread": unread,
        })

    active_id = request.args.get("conv", type=int)
    active_conv = None
    messages = []
    if active_id:
        conv = get_conversation_for_user(active_id, current_user.id)
        if conv:
            active_conv = conv
            messages = Message.query.filter_by(conversation_id=active_id).order_by(Message.created_at.asc()).all()
            mark_conversation_read(active_id, current_user.id)

    return render_template(
        "chat.html", conv_list=conv_list, active_conv=active_conv, messages=messages,
    )


@bp.route("/api/chat/start/<int:other_user_id>", methods=["POST"])
@login_required
def start_chat(other_user_id):
    if other_user_id == current_user.id:
        return jsonify({"error": "cannot chat with yourself"}), 400

    payload = request.get_json(silent=True) or {}
    property_id = payload.get("property_id")

    conv = Conversation.query.filter(
        db.or_(
            db.and_(Conversation.user1_id == current_user.id, Conversation.user2_id == other_user_id),
            db.and_(Conversation.user1_id == other_user_id, Conversation.user2_id == current_user.id),
        )
    ).first()

    if not conv:
        conv = Conversation(
            user1_id=current_user.id, user2_id=other_user_id, property_id=property_id,
        )
        db.session.add(conv)
        db.session.commit()

    return jsonify({"conversation_id": conv.id})


@bp.route("/api/chat/<int:conv_id>/send", methods=["POST"])
@login_required
@limiter.limit("30 per minute")
def send_message(conv_id):
    conv = get_conversation_for_user(conv_id, current_user.id)
    if not conv:
        return jsonify({"error": "forbidden"}), 403

    try:
        data = MessageIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    msg = create_message(conv_id, current_user.id, data.body)
    if not msg:
        return jsonify({"error": "empty message"}), 400

    # Notify the other participant
    other_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
    create_notification(
        other_id, "message",
        f"הודעה חדשה מ-{current_user.first_name}",
        {"conversation_id": conv_id, "message_id": msg.id, "preview": data.body[:120]},
    )

    # Echo via socketio to both participants
    from rentmate.extensions import socketio
    socketio.emit("message:new", serialize_message(msg), room=f"conv:{conv_id}")

    return jsonify(serialize_message(msg))


@bp.route("/api/chat/<int:conv_id>/messages")
@login_required
def get_messages(conv_id):
    conv = get_conversation_for_user(conv_id, current_user.id)
    if not conv:
        return jsonify({"error": "forbidden"}), 403

    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, request.args.get("per_page", 50, type=int))
    q = Message.query.filter_by(conversation_id=conv_id).order_by(Message.created_at.asc())
    pagination = q.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [serialize_message(m) for m in pagination.items],
        "page": pagination.page,
        "pages": pagination.pages,
        "total": pagination.total,
    })
