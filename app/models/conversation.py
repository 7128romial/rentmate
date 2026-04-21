"""Conversation — thread between two users about a specific listing."""

from datetime import datetime

from app.extensions import db


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id"), index=True)
    initiator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_message_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    # Firestore document id for client-side realtime sync
    firestore_doc_id = db.Column(db.String(128))

    initiator = db.relationship("User", foreign_keys=[initiator_id])
    recipient = db.relationship("User", foreign_keys=[recipient_id])
    messages = db.relationship(
        "Message", backref="conversation", cascade="all, delete-orphan",
        lazy=True, order_by="Message.created_at.asc()",
    )

    def other_participant(self, user_id):
        return self.recipient if self.initiator_id == user_id else self.initiator
