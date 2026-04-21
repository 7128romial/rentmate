"""Seed script — creates demo users, apartments, and listings.

Run manually: `python seed.py`. Safe to run on a fresh DB; skips if users exist.
"""

from datetime import date, timedelta

from app import create_app
from app.extensions import db
from app.models import (
    User, UserRole, RoleType, Gender,
    Apartment, Listing, ListingImage, ListingType, ListingStatus,
)


DEMO_PREFS_TENANT = {
    "budget_min": 3500, "budget_max": 6000,
    "preferred_cities": ["תל אביב"],
    "preferred_neighborhoods": ["פלורנטין", "הצפון הישן"],
    "move_in_date": (date.today() + timedelta(days=21)).isoformat(),
    "lifestyle": {
        "social_level": "balanced", "cleanliness": 4,
        "smoking": "no", "pets": False,
        "guests_frequency": "sometimes", "wfh": True,
    },
    "priority": "location",
}

DEMO_PREFS_ROOMMATE = {
    "budget_min": 2000, "budget_max": 3500,
    "preferred_cities": ["תל אביב", "רמת גן"],
    "preferred_neighborhoods": [],
    "move_in_date": (date.today() + timedelta(days=14)).isoformat(),
    "lifestyle": {
        "social_level": "social", "cleanliness": 3,
        "smoking": "outdoor", "pets": True,
        "guests_frequency": "often", "wfh": False,
    },
    "priority": "price",
}


def run():
    app = create_app()
    with app.app_context():
        if User.query.count() >= 5:
            print("seed: users already present, skipping.")
            return

        users = _create_users()
        apartments = _create_apartments(users)
        _create_listings(apartments, users)

        db.session.commit()
        print(f"seed: created {len(users)} users, {len(apartments)} apartments, listings.")


def _create_users():
    people = [
        # phone, first, last, role(s), prefs
        ("+972501234001", "יעל", "כהן", [RoleType.TENANT], DEMO_PREFS_TENANT),
        ("+972501234002", "עומר", "לוי", [RoleType.ROOMMATE], DEMO_PREFS_ROOMMATE),
        ("+972501234003", "דוד", "אברהם", [RoleType.LANDLORD], None),
        ("+972501234004", "שרה", "ישראלי", [RoleType.LANDLORD, RoleType.ROOMMATE], DEMO_PREFS_ROOMMATE),
        ("+972501234005", "משה", "דהן", [RoleType.LANDLORD], None),
    ]
    users = []
    for phone, first, last, roles, prefs in people:
        u = User(
            phone=phone, first_name=first, last_name=last,
            bio=f"שלום, אני {first}. נעים להכיר!",
            is_verified=True,
            gender=Gender.UNDISCLOSED,
        )
        if prefs:
            u.preferences = prefs
        db.session.add(u)
        db.session.flush()
        for r in roles:
            db.session.add(UserRole(user_id=u.id, role=r, is_active=True))
        users.append(u)
    return users


def _create_apartments(users):
    landlord_david = next(u for u in users if u.first_name == "דוד")
    landlord_sara = next(u for u in users if u.first_name == "שרה")
    landlord_moshe = next(u for u in users if u.first_name == "משה")

    data = [
        dict(owner=landlord_david, address="דיזנגוף 120", city="תל אביב",
             neighborhood="הצפון הישן", latitude=32.0853, longitude=34.7818,
             rooms=3, size_sqm=85, floor=4, has_elevator=True, has_balcony=True, is_furnished=True, has_parking=False,
             allows_pets=False, allows_smoking=False),
        dict(owner=landlord_david, address="רוטשילד 50", city="תל אביב",
             neighborhood="לב העיר", latitude=32.0683, longitude=34.7744,
             rooms=1, size_sqm=35, floor=2, has_elevator=False, is_furnished=True,
             allows_pets=True, allows_smoking=False),
        dict(owner=landlord_sara, address="רחל אמנו 15", city="ירושלים",
             neighborhood="בקעה", latitude=31.7623, longitude=35.2227,
             rooms=4, size_sqm=110, floor=1, has_parking=True, has_balcony=True,
             allows_pets=True, allows_smoking=False),
        dict(owner=landlord_sara, address="עזה 30", city="ירושלים",
             neighborhood="רחביה", latitude=31.7780, longitude=35.2156,
             rooms=1, size_sqm=18, floor=3, has_elevator=True, is_furnished=True),
        dict(owner=landlord_moshe, address="הנשיא 45", city="חיפה",
             neighborhood="כרמל מרכזי", latitude=32.7940, longitude=34.9896,
             rooms=3, size_sqm=90, floor=0, has_parking=True, has_balcony=True, has_elevator=False,
             allows_pets=True, allows_smoking=True),
        dict(owner=landlord_moshe, address="שדרות הנשיא 100", city="חיפה",
             neighborhood="כרמל צרפתי", latitude=32.8030, longitude=34.9829,
             rooms=5, size_sqm=160, floor=12, has_elevator=True, has_parking=True, has_balcony=True, is_furnished=True),
        dict(owner=landlord_david, address="ויטל 8", city="תל אביב",
             neighborhood="פלורנטין", latitude=32.0571, longitude=34.7708,
             rooms=2, size_sqm=55, floor=3, is_furnished=True, has_balcony=True,
             allows_pets=True, allows_smoking=True),
        dict(owner=landlord_sara, address="הדקלים 22", city="ראשון לציון",
             neighborhood="נווה הדרים", latitude=31.9730, longitude=34.7925,
             rooms=4, size_sqm=140, floor=0, has_parking=True, allows_pets=True),
        dict(owner=landlord_moshe, address="ז'בוטינסקי 60", city="רמת גן",
             neighborhood="בורסה", latitude=32.0808, longitude=34.8012,
             rooms=1, size_sqm=15, floor=8, has_elevator=True, has_parking=True, is_furnished=True),
        dict(owner=landlord_david, address="שלמה המלך 35", city="תל אביב",
             neighborhood="נווה שאנן", latitude=32.0605, longitude=34.7746,
             rooms=3.5, size_sqm=95, floor=5, has_elevator=True, has_parking=True, has_balcony=True),
    ]
    apartments = []
    for d in data:
        owner = d.pop("owner")
        a = Apartment(owner_id=owner.id, **d)
        db.session.add(a)
        db.session.flush()
        apartments.append(a)
    return apartments


def _create_listings(apartments, users):
    today = date.today()
    for i, apt in enumerate(apartments):
        # First listing (whole apartment) per apartment
        listing = Listing(
            apartment_id=apt.id, publisher_id=apt.owner_id,
            listing_type=(ListingType.ROOM_IN_SHARED if apt.size_sqm and apt.size_sqm < 25 else ListingType.WHOLE_APARTMENT),
            monthly_price=int(_price_for(apt)),
            available_from=today + timedelta(days=7 * (i % 5)),
            min_lease_months=12,
            description=f"דירה נעימה ב{apt.neighborhood or apt.city}, כניסה מיידית. פנו לבעלים לתיאום ביקור.",
            status=ListingStatus.ACTIVE,
            preferences={"lifestyle_tags": ["clean", "quiet"] if i % 2 == 0 else ["social"]},
        )
        db.session.add(listing)
        db.session.flush()

        # Give each listing a gradient placeholder image (external picsum.photos URL; no auth needed)
        db.session.add(ListingImage(
            listing_id=listing.id,
            image_url=f"https://picsum.photos/seed/rentmate-{listing.id}/1200/800",
            display_order=0, is_primary=True,
        ))


def _price_for(apt):
    base = 2500
    by_city = {"תל אביב": 1800, "ירושלים": 900, "חיפה": 400, "רמת גן": 1600, "ראשון לציון": 900}
    per_room = 900
    return base + by_city.get(apt.city or "", 500) + float(apt.rooms) * per_room


if __name__ == "__main__":
    run()
