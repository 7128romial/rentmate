"""Firebase Admin — Firestore writes for chat + FCM push for notifications.

All access goes through this service so the rest of the app can stay oblivious
to whether Firebase is actually configured.
"""

import logging
import os

from flask import current_app

logger = logging.getLogger(__name__)

_initialized = False
_fs_client = None


def _ensure_initialized():
    global _initialized, _fs_client
    if _initialized:
        return
    creds_path = current_app.config.get("FIREBASE_CREDENTIALS_PATH")
    if not creds_path or not os.path.exists(creds_path):
        _initialized = True   # mark so we don't retry every call
        return
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore

        if not firebase_admin._apps:
            cred = credentials.Certificate(creds_path)
            firebase_admin.initialize_app(cred)
        _fs_client = firestore.client()
    except Exception:
        logger.exception("Firebase Admin init failed")
    _initialized = True


def firestore_available():
    _ensure_initialized()
    return _fs_client is not None


def write_message_to_firestore(conversation_id, message_doc):
    """Append a message to the Firestore subcollection for a conversation.

    Returns the Firestore message-doc id or None if Firebase isn't configured.
    """
    _ensure_initialized()
    if _fs_client is None:
        return None
    try:
        conv_ref = _fs_client.collection("conversations").document(str(conversation_id))
        msg_ref = conv_ref.collection("messages").document()
        msg_ref.set(message_doc)
        conv_ref.set({
            "last_message_at": message_doc.get("created_at"),
            "last_preview": message_doc.get("content", "")[:200],
        }, merge=True)
        return msg_ref.id
    except Exception:
        logger.exception("firestore write failed")
        return None


def set_typing_status(conversation_id, user_id, is_typing):
    _ensure_initialized()
    if _fs_client is None:
        return
    try:
        _fs_client.collection("conversations").document(str(conversation_id)) \
            .set({"typing": {str(user_id): bool(is_typing)}}, merge=True)
    except Exception:
        logger.exception("firestore typing update failed")


def send_push(fcm_token, title, body, data=None):
    """Send a single-device FCM push. Silent no-op if Firebase is unavailable."""
    _ensure_initialized()
    if _fs_client is None or not fcm_token:
        return False
    try:
        from firebase_admin import messaging
        msg = messaging.Message(
            token=fcm_token,
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
        )
        messaging.send(msg)
        return True
    except Exception:
        logger.exception("FCM send failed")
        return False
