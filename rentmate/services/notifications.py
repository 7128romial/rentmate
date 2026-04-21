"""Notification creation — persists a DB row and emits a live socket event."""

import json

from rentmate.extensions import db, socketio
from models import Notification


def create_notification(user_id, type_, message, payload=None, emit=True):
    notif = Notification(
        user_id=user_id,
        type=type_,
        message=message,
        payload=json.dumps(payload) if payload else None,
    )
    db.session.add(notif)
    db.session.commit()

    if emit:
        socketio.emit(
            "notification:new",
            {
                "id": notif.id,
                "type": notif.type,
                "message": notif.message,
                "payload": payload or {},
                "created_at": notif.created_at.isoformat(),
            },
            room=f"user:{user_id}",
        )
    return notif


def serialize_notification(notif):
    return {
        "id": notif.id,
        "type": notif.type,
        "message": notif.message,
        "payload": json.loads(notif.payload) if notif.payload else {},
        "is_read": notif.is_read,
        "created_at": notif.created_at.isoformat(),
    }
