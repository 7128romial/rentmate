"""User and UserRole models — multi-role per spec section 5."""

import enum
from datetime import datetime

from flask_login import UserMixin
from sqlalchemy import Enum as SAEnum

from app.extensions import db


class RoleType(str, enum.Enum):
    TENANT = "tenant"
    ROOMMATE = "roommate"
    LANDLORD = "landlord"


class Gender(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"
    UNDISCLOSED = "undisclosed"


class User(db.Model, UserMixin):
    """Central user identity. A user can hold multiple roles simultaneously."""
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), unique=True, nullable=False, index=True)
    first_name = db.Column(db.String(50), nullable=False, default="")
    last_name = db.Column(db.String(50), nullable=False, default="")
    birth_date = db.Column(db.Date)
    gender = db.Column(SAEnum(Gender, native_enum=False, length=20), default=Gender.UNDISCLOSED)
    profile_image_url = db.Column(db.String(500))
    bio = db.Column(db.Text, default="")
    is_verified = db.Column(db.Boolean, default=False)

    # Lifestyle + rental preferences (populated by AI agent). Stored as JSON for
    # flexibility as the interviewer evolves. Schema documented in
    # app/services/openai_service.py::EXTRACTED_PREFERENCES_SCHEMA.
    preferences = db.Column(db.JSON, default=dict)

    # FCM device token for push notifications (most recent device wins for MVP)
    fcm_token = db.Column(db.String(500))

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    roles = db.relationship("UserRole", backref="user", cascade="all, delete-orphan", lazy="joined")
    apartments = db.relationship("Apartment", backref="owner", lazy=True)
    notifications = db.relationship("Notification", backref="user", cascade="all, delete-orphan", lazy=True)

    # ------ convenience properties ------
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or "משתמש"

    @property
    def initials(self):
        parts = [p for p in (self.first_name, self.last_name) if p]
        return "".join(p[0] for p in parts).upper() or "?"

    @property
    def active_roles(self):
        return {r.role for r in self.roles if r.is_active}

    def has_role(self, role):
        if isinstance(role, str):
            role = RoleType(role)
        return role in self.active_roles

    def display_gender(self):
        return {
            Gender.MALE: "זכר",
            Gender.FEMALE: "נקבה",
            Gender.OTHER: "אחר",
            Gender.UNDISCLOSED: "",
        }.get(self.gender, "")


class UserRole(db.Model):
    """One row per (user, role) pair — lets a user toggle being a tenant *and* a landlord."""
    __tablename__ = "user_roles"
    __table_args__ = (
        db.UniqueConstraint("user_id", "role", name="uq_user_role"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = db.Column(SAEnum(RoleType, native_enum=False, length=20), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
