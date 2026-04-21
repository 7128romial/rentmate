"""Message — archived copy of every chat message (Firestore is source of truth for realtime)."""

from datetime import datetime

from app.extensions import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id", ondelete="CASCADE"),
                                nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    firebase_message_id = db.Column(db.String(128))  # set when synced to Firestore
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    sender = db.relationship("User")
