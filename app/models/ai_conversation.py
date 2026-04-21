"""AIConversation — persisted transcript of the AI preference interview."""

from datetime import datetime

from app.extensions import db


class AIConversation(db.Model):
    __tablename__ = "ai_conversations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    # Full transcript: [{"role": "assistant|user|system", "content": "..."}, ...]
    messages = db.Column(db.JSON, default=list, nullable=False)

    # Structured output the agent extracted from the chat.
    # Schema: see app/services/openai_service.py::EXTRACTED_PREFERENCES_SCHEMA
    extracted_preferences = db.Column(db.JSON, default=dict)

    completed = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship("User")
