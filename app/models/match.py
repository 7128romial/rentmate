"""Match — the scored result of matching_engine for a (user, listing) pair."""

import enum
from datetime import datetime

from sqlalchemy import Enum as SAEnum

from app.extensions import db


class MatchAction(str, enum.Enum):
    PENDING = "pending"
    LIKED = "liked"
    PASSED = "passed"
    SAVED = "saved"


class Match(db.Model):
    __tablename__ = "matches"
    __table_args__ = (
        db.UniqueConstraint("user_id", "listing_id", name="uq_match_user_listing"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id", ondelete="CASCADE"),
                           nullable=False, index=True)
    match_score = db.Column(db.Numeric(5, 2), nullable=False)
    score_breakdown = db.Column(db.JSON)   # { location_score, budget_score, lifestyle_score, availability_score, reason }
    user_action = db.Column(SAEnum(MatchAction, native_enum=False, length=20),
                            default=MatchAction.PENDING, nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User")
