from app import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False) # 'renter', 'roommate', 'landlord'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    preferences = db.relationship('PreferenceProfile', backref='user', uselist=False)

class PreferenceProfile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    max_budget = db.Column(db.Integer)
    locations = db.Column(db.String(200)) # comma separated
    lifestyle_tags = db.Column(db.String(500)) # JSON string
    ai_summary = db.Column(db.Text)

class Property(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    landlord_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    price = db.Column(db.Integer, nullable=False)
    location = db.Column(db.String(100), nullable=False)
    images = db.Column(db.String(1000)) # JSON array of URLs
    move_in_date = db.Column(db.DateTime)
