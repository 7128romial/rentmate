from extensions import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='renter') # 'renter', 'roommate', 'landlord'
    subscription = db.Column(db.String(20), nullable=False, default='free') # 'free' | 'pro'
    subscription_until = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    preferences = db.relationship('PreferenceProfile', backref='user', uselist=False)

class PreferenceProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100))
    city = db.Column(db.String(100))
    max_budget = db.Column(db.Integer)
    type = db.Column(db.String(50))
    extras = db.Column(db.String(500))

class Property(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    price_min = db.Column(db.Integer)
    price_max = db.Column(db.Integer)
    price_label = db.Column(db.String(100))
    location = db.Column(db.String(100))
    address = db.Column(db.String(250))
    image = db.Column(db.String(500))
    tags = db.Column(db.String(500)) # JSON encoded array or comma separated
    rooms = db.Column(db.Float)
    area = db.Column(db.Integer)
    floor = db.Column(db.Integer)
    total_floors = db.Column(db.Integer)
    available = db.Column(db.String(50))
    description = db.Column(db.Text)
    amenities = db.Column(db.Text) # JSON encoded array
    status = db.Column(db.String(20), default='available') # 'available', 'rented', 'off_market'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Swipe(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    direction = db.Column(db.String(10), nullable=False) # 'right' or 'left'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Match(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class PropertyInterest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    renter_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(20), default='pending') # 'pending', 'approved', 'rejected'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class DirectMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    property_id = db.Column(db.Integer, db.ForeignKey('property.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
