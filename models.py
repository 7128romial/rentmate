from datetime import datetime
from rentmate.extensions import db, bcrypt
from flask_login import UserMixin


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20))
    age = db.Column(db.Integer)
    gender = db.Column(db.String(10))  # male / female / other
    city = db.Column(db.String(50))
    profile_image = db.Column(db.String(200))
    avatar_filename = db.Column(db.String(200))
    is_verified = db.Column(db.Boolean, default=False)
    last_seen_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    role = db.Column(db.String(20), nullable=False, default="tenant")  # tenant / roommate / landlord

    preferences = db.relationship("UserPreferences", backref="user", uselist=False, cascade="all, delete-orphan")
    properties = db.relationship("Property", backref="landlord", lazy=True)
    favorites = db.relationship("Favorite", backref="user", lazy=True)

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode("utf-8")

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    @property
    def initials(self):
        return (self.first_name[0] + self.last_name[0]).upper() if self.first_name and self.last_name else "?"

    @property
    def avatar_url(self):
        from flask import url_for
        if self.avatar_filename:
            return url_for("static", filename=f"uploads/avatars/{self.avatar_filename}")
        return None


class UserPreferences(db.Model):
    __tablename__ = "user_preferences"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    preferred_city = db.Column(db.String(50))
    max_rent = db.Column(db.Integer)
    smoking = db.Column(db.String(10), default="no")
    pets = db.Column(db.Boolean, default=False)
    cleanliness_level = db.Column(db.Integer, default=3)
    noise_level = db.Column(db.String(10), default="moderate")
    sleep_schedule = db.Column(db.String(10), default="normal")
    preferred_gender = db.Column(db.String(10), default="any")
    move_in_date = db.Column(db.Date)
    min_rental_months = db.Column(db.Integer, default=12)
    preferred_property_type = db.Column(db.String(20))
    roommate_age_min = db.Column(db.Integer, default=18)
    roommate_age_max = db.Column(db.Integer, default=50)


class Property(db.Model):
    __tablename__ = "properties"

    id = db.Column(db.Integer, primary_key=True)
    landlord_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    city = db.Column(db.String(50), nullable=False)
    neighborhood = db.Column(db.String(100))
    address = db.Column(db.String(200))
    property_type = db.Column(db.String(20), nullable=False)
    rooms = db.Column(db.Float)
    floor = db.Column(db.Integer)
    size_sqm = db.Column(db.Integer)
    rent_price = db.Column(db.Integer, nullable=False)
    furnished = db.Column(db.Boolean, default=False)
    parking = db.Column(db.Boolean, default=False)
    elevator = db.Column(db.Boolean, default=False)
    balcony = db.Column(db.Boolean, default=False)
    ac = db.Column(db.Boolean, default=False)
    storage = db.Column(db.Boolean, default=False)
    pets_allowed = db.Column(db.Boolean, default=False)
    smoking_allowed = db.Column(db.Boolean, default=False)
    available_from = db.Column(db.Date)
    min_rental_months = db.Column(db.Integer, default=12)
    roommate_gender = db.Column(db.String(10))
    max_roommates = db.Column(db.Integer)
    status = db.Column(db.String(10), default="active")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    images = db.relationship(
        "PropertyImage",
        backref="property",
        lazy=True,
        cascade="all, delete-orphan",
        order_by="PropertyImage.order.asc()",
    )
    favorites = db.relationship("Favorite", backref="property", lazy=True)

    @property
    def primary_image(self):
        img = PropertyImage.query.filter_by(property_id=self.id, is_primary=True).first()
        if not img:
            img = PropertyImage.query.filter_by(property_id=self.id).order_by(PropertyImage.order.asc()).first()
        return img.image_url if img else None


class PropertyImage(db.Model):
    __tablename__ = "property_images"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"), nullable=False)
    image_url = db.Column(db.String(300), nullable=False)
    thumb_url = db.Column(db.String(300))
    is_primary = db.Column(db.Boolean, default=False)
    order = db.Column(db.Integer, default=0)


class Favorite(db.Model):
    __tablename__ = "favorites"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint("user_id", "property_id"),)


class Conversation(db.Model):
    __tablename__ = "conversations"

    id = db.Column(db.Integer, primary_key=True)
    user1_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user2_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user1 = db.relationship("User", foreign_keys=[user1_id])
    user2 = db.relationship("User", foreign_keys=[user2_id])
    prop = db.relationship("Property")
    messages = db.relationship("Message", backref="conversation", lazy=True, order_by="Message.created_at")


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)
    conversation_id = db.Column(db.Integer, db.ForeignKey("conversations.id"), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship("User")


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    type = db.Column(db.String(30))
    message = db.Column(db.String(300))
    payload = db.Column(db.Text)  # JSON blob
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Match(db.Model):
    __tablename__ = "matches"

    id = db.Column(db.Integer, primary_key=True)
    user_a_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user_b_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_a = db.relationship("User", foreign_keys=[user_a_id])
    user_b = db.relationship("User", foreign_keys=[user_b_id])
    prop = db.relationship("Property")

    __table_args__ = (db.UniqueConstraint("user_a_id", "user_b_id", "property_id"),)
