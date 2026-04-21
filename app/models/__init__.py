"""SQLAlchemy models package — re-exports everything for easy imports."""

from app.models.user import User, UserRole, RoleType, Gender
from app.models.apartment import Apartment
from app.models.listing import Listing, ListingImage, ListingType, ListingStatus
from app.models.match import Match, MatchAction
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.notification import Notification, NotificationType
from app.models.ai_conversation import AIConversation

__all__ = [
    "User", "UserRole", "RoleType", "Gender",
    "Apartment",
    "Listing", "ListingImage", "ListingType", "ListingStatus",
    "Match", "MatchAction",
    "Conversation", "Message",
    "Notification", "NotificationType",
    "AIConversation",
]
