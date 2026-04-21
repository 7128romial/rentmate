"""Notification helpers — create DB row + fire FCM push."""

from app.extensions import db
from app.models import Notification, NotificationType, User
from app.services.firebase_service import send_push


def _create(user_id, ntype, title, body, related_id=None):
    notif = Notification(
        user_id=user_id, type=ntype, title=title, body=body,
        related_entity_id=related_id,
    )
    db.session.add(notif)
    db.session.commit()

    user = db.session.get(User, user_id)
    if user and user.fcm_token:
        send_push(user.fcm_token, title, body,
                  data={"notification_id": notif.id, "type": ntype.value, "related_id": related_id or ""})
    return notif


def notify_high_match(listing, candidate, score):
    """Tell the landlord that a strong candidate just liked their listing."""
    _create(
        user_id=listing.publisher_id,
        ntype=NotificationType.HIGH_MATCH,
        title=f"התאמה חזקה ({int(score)}%)",
        body=f"{candidate.first_name or 'מועמד'} התעניין במודעה שלך",
        related_id=listing.id,
    )


def notify_new_message(recipient_id, sender, conversation_id, preview):
    _create(
        user_id=recipient_id,
        ntype=NotificationType.NEW_MESSAGE,
        title=f"הודעה חדשה מ-{sender.first_name or 'משתמש'}",
        body=preview,
        related_id=conversation_id,
    )


def notify_new_listing_in_area(user_id, listing):
    apt = listing.apartment
    loc = f"{apt.neighborhood or apt.city}" if apt else ""
    _create(
        user_id=user_id,
        ntype=NotificationType.NEW_LISTING_IN_AREA,
        title="דירה חדשה באזור שלך",
        body=f"{loc} · ₪{listing.monthly_price:,}".strip(" ·"),
        related_id=listing.id,
    )
