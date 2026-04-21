"""Listing and ListingImage — a public offer for a specific apartment."""

import enum
from datetime import datetime

from sqlalchemy import Enum as SAEnum

from app.extensions import db


class ListingType(str, enum.Enum):
    WHOLE_APARTMENT = "whole_apartment"
    ROOM_IN_SHARED = "room_in_shared"


class ListingStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    RENTED = "rented"
    CLOSED = "closed"


class Listing(db.Model):
    __tablename__ = "listings"

    id = db.Column(db.Integer, primary_key=True)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id", ondelete="CASCADE"), nullable=False)
    publisher_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    listing_type = db.Column(SAEnum(ListingType, native_enum=False, length=30), nullable=False)
    monthly_price = db.Column(db.Integer, nullable=False)
    available_from = db.Column(db.Date)
    min_lease_months = db.Column(db.Integer, default=12)
    description = db.Column(db.Text, default="")
    status = db.Column(SAEnum(ListingStatus, native_enum=False, length=20),
                       default=ListingStatus.ACTIVE, nullable=False, index=True)

    # Desired-tenant preferences — JSON for schema flexibility:
    # {"desired_gender": "any|male|female", "num_roommates_desired": 0,
    #  "lifestyle_tags": ["quiet", "clean", "wfh"], "notes": "..."}
    preferences = db.Column(db.JSON, default=dict)

    view_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    publisher = db.relationship("User", foreign_keys=[publisher_id])
    images = db.relationship(
        "ListingImage", backref="listing", cascade="all, delete-orphan",
        lazy=True, order_by="ListingImage.display_order.asc()",
    )
    matches = db.relationship("Match", backref="listing", cascade="all, delete-orphan", lazy=True)
    conversations = db.relationship("Conversation", backref="listing", lazy=True)

    @property
    def primary_image_url(self):
        img = next((i for i in self.images if i.is_primary), None) or (self.images[0] if self.images else None)
        return img.image_url if img else None


class ListingImage(db.Model):
    __tablename__ = "listing_images"

    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    image_url = db.Column(db.String(500), nullable=False)
    display_order = db.Column(db.Integer, default=0)
    is_primary = db.Column(db.Boolean, default=False)
