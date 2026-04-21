"""Shared chat operations — used by both HTTP and Socket.IO handlers."""

from datetime import datetime

from rentmate.extensions import db
from models import Conversation, Message


def get_conversation_for_user(conv_id, user_id):
    conv = db.session.get(Conversation, conv_id)
    if not conv:
        return None
    if conv.user1_id != user_id and conv.user2_id != user_id:
        return None
    return conv


def other_participant_id(conv, user_id):
    return conv.user2_id if conv.user1_id == user_id else conv.user1_id


def create_message(conv_id, sender_id, body):
    body = (body or "").strip()
    if not body:
        return None
    msg = Message(conversation_id=conv_id, sender_id=sender_id, body=body)
    db.session.add(msg)
    db.session.commit()
    return msg


def mark_conversation_read(conv_id, reader_id):
    now = datetime.utcnow()
    Message.query.filter(
        Message.conversation_id == conv_id,
        Message.sender_id != reader_id,
        Message.is_read == False,  # noqa: E712
    ).update({"is_read": True, "read_at": now})
    db.session.commit()


def serialize_message(msg):
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "body": msg.body,
        "sender_id": msg.sender_id,
        "created_at": msg.created_at.isoformat(),
        "is_read": msg.is_read,
    }
