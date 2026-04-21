"""Apartment — the physical unit (vs Listing which is the published offer)."""

from datetime import datetime

from app.extensions import db


class Apartment(db.Model):
    """Physical apartment data. One apartment may have many listings over time."""
    __tablename__ = "apartments"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False, index=True)
    neighborhood = db.Column(db.String(100))
    latitude = db.Column(db.Numeric(10, 7))
    longitude = db.Column(db.Numeric(10, 7))

    rooms = db.Column(db.Numeric(3, 1), nullable=False)
    size_sqm = db.Column(db.Integer)
    floor = db.Column(db.Integer)
    has_elevator = db.Column(db.Boolean, default=False)
    has_parking = db.Column(db.Boolean, default=False)
    has_balcony = db.Column(db.Boolean, default=False)
    is_furnished = db.Column(db.Boolean, default=False)
    allows_pets = db.Column(db.Boolean, default=False)
    allows_smoking = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    listings = db.relationship("Listing", backref="apartment", cascade="all, delete-orphan", lazy=True)

    @property
    def full_address(self):
        parts = [p for p in (self.address, self.neighborhood, self.city) if p]
        return ", ".join(parts)
