"""Mutual-match detection fired when a user likes a property."""

from rentmate.extensions import db, socketio
from models import Favorite, Match, Property, User
from rentmate.services.notifications import create_notification
from rentmate.services.email import send_email


def detect_mutual_match(user, property_id):
    """Called after `user` likes `property_id`.

    Mutual match = the property's landlord has also favorited *any* of
    `user`'s own properties. If matched, records a Match row, notifies both
    sides, emits a socket event, and sends email.
    """
    prop = db.session.get(Property, property_id)
    if not prop:
        return None
    landlord = db.session.get(User, prop.landlord_id)
    if not landlord or landlord.id == user.id:
        return None

    # Has the landlord favorited any of this user's properties?
    user_property_ids = [p.id for p in Property.query.filter_by(
        landlord_id=user.id, status="active"
    ).all()]
    if not user_property_ids:
        # Tenants without listings can still be matched by mutual property like
        # (both favorited this same property)
        other_fav = Favorite.query.filter(
            Favorite.property_id == property_id,
            Favorite.user_id == landlord.id,
        ).first()
        if not other_fav:
            return None
    else:
        reciprocal = Favorite.query.filter(
            Favorite.user_id == landlord.id,
            Favorite.property_id.in_(user_property_ids),
        ).first()
        if not reciprocal:
            return None

    # Avoid duplicate Match rows
    low, high = sorted([user.id, landlord.id])
    existing = Match.query.filter_by(
        user_a_id=low, user_b_id=high, property_id=property_id
    ).first()
    if existing:
        return existing

    match = Match(
        user_a_id=low, user_b_id=high, property_id=property_id
    )
    db.session.add(match)
    db.session.commit()

    # Notify both participants
    payload = {
        "match_id": match.id,
        "property_id": property_id,
        "property_title": prop.title,
    }
    for uid, other in [(user.id, landlord), (landlord.id, user)]:
        payload_with_other = dict(payload, other_user={
            "id": other.id,
            "first_name": other.first_name,
            "last_name": other.last_name,
            "avatar_url": other.avatar_url,
            "initials": other.initials,
        })
        create_notification(
            uid,
            "match",
            f"יש לך התאמה חדשה עם {other.first_name}!",
            payload_with_other,
        )
        socketio.emit("match:new", payload_with_other, room=f"user:{uid}")
        target_user = user if uid == user.id else landlord
        send_email(
            target_user.email,
            "יש לך התאמה חדשה ב-RentMate! 🎉",
            "match",
            other_user=other,
            property_=prop,
            target_user=target_user,
        )

    return match
