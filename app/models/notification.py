"""Notification — in-app + mirrored to FCM push."""

import enum
from datetime import datetime

from sqlalchemy import Enum as SAEnum

from app.extensions import db


class NotificationType(str, enum.Enum):
    HIGH_MATCH = "high_match"         # match with score >= 85 in desired area
    NEW_MESSAGE = "new_message"
    NEW_LISTING_IN_AREA = "new_listing_in_area"
    VERIFICATION_COMPLETE = "verification_complete"
    SYSTEM = "system"


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    type = db.Column(SAEnum(NotificationType, native_enum=False, length=40), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.String(500))
    related_entity_id = db.Column(db.Integer)   # listing_id / conversation_id / etc.
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
