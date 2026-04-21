"""Socket.IO event handlers — real-time chat + presence + notifications.

Rooms used:
  - user:<id>     every connected device for a user
  - conv:<id>     all participants in a conversation
"""

from datetime import datetime

from flask import request
from flask_login import current_user
from flask_socketio import emit, join_room, leave_room

from rentmate.extensions import socketio, db
from rentmate.services.chat import (
    get_conversation_for_user,
    create_message,
    mark_conversation_read,
    serialize_message,
)
from rentmate.services.notifications import create_notification

# In-memory presence (per-process). For multi-instance use redis message_queue.
_online_sids = {}  # user_id -> set of sids


def _uid():
    if not current_user.is_authenticated:
        return None
    return current_user.id


def _touch_last_seen(user):
    user.last_seen_at = datetime.utcnow()
    db.session.commit()


@socketio.on("connect")
def on_connect():
    uid = _uid()
    if not uid:
        return False
    _online_sids.setdefault(uid, set()).add(request.sid)
    join_room(f"user:{uid}")
    _touch_last_seen(current_user)
    emit("presence:update", {"user_id": uid, "online": True}, broadcast=True)


@socketio.on("disconnect")
def on_disconnect():
    uid = _uid()
    if not uid:
        return
    sids = _online_sids.get(uid, set())
    sids.discard(request.sid)
    if not sids:
        _online_sids.pop(uid, None)
        _touch_last_seen(current_user)
        emit("presence:update", {"user_id": uid, "online": False}, broadcast=True)


@socketio.on("join_conversation")
def on_join_conversation(data):
    uid = _uid()
    if not uid:
        return
    conv_id = int(data.get("conversation_id", 0))
    conv = get_conversation_for_user(conv_id, uid)
    if not conv:
        return
    join_room(f"conv:{conv_id}")
    mark_conversation_read(conv_id, uid)
    emit("read_receipt", {"conversation_id": conv_id, "reader_id": uid},
         room=f"conv:{conv_id}", include_self=False)


@socketio.on("leave_conversation")
def on_leave_conversation(data):
    conv_id = int(data.get("conversation_id", 0))
    leave_room(f"conv:{conv_id}")


@socketio.on("send_message")
def on_send_message(data):
    uid = _uid()
    if not uid:
        return
    conv_id = int(data.get("conversation_id", 0))
    body = (data.get("body") or "").strip()
    if not body:
        return
    conv = get_conversation_for_user(conv_id, uid)
    if not conv:
        return

    msg = create_message(conv_id, uid, body)
    payload = serialize_message(msg)
    emit("message:new", payload, room=f"conv:{conv_id}")

    # Notify the other participant (socket + DB row)
    other_id = conv.user2_id if conv.user1_id == uid else conv.user1_id
    create_notification(
        other_id, "message",
        f"הודעה חדשה מ-{current_user.first_name}",
        {"conversation_id": conv_id, "message_id": msg.id, "preview": body[:120]},
    )


@socketio.on("typing")
def on_typing(data):
    uid = _uid()
    if not uid:
        return
    conv_id = int(data.get("conversation_id", 0))
    conv = get_conversation_for_user(conv_id, uid)
    if not conv:
        return
    emit("typing", {"conversation_id": conv_id, "user_id": uid,
                    "is_typing": bool(data.get("is_typing", True))},
         room=f"conv:{conv_id}", include_self=False)


@socketio.on("read_receipt")
def on_read(data):
    uid = _uid()
    if not uid:
        return
    conv_id = int(data.get("conversation_id", 0))
    conv = get_conversation_for_user(conv_id, uid)
    if not conv:
        return
    mark_conversation_read(conv_id, uid)
    emit("read_receipt", {"conversation_id": conv_id, "reader_id": uid},
         room=f"conv:{conv_id}", include_self=False)
