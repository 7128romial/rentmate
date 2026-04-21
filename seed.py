"""Development seed data — only runs if the users table is empty."""

from datetime import date

from rentmate.extensions import db
from models import User, UserPreferences, Property, PropertyImage


def seed_if_empty():
    if User.query.first():
        return

    landlord1 = User(email="david@example.com", first_name="דוד", last_name="כהן",
                     phone="050-1234567", age=45, gender="male", city="תל אביב", role="landlord")
    landlord1.set_password("password123")

    landlord2 = User(email="sara@example.com", first_name="שרה", last_name="לוי",
                     phone="050-7654321", age=38, gender="female", city="ירושלים", role="landlord")
    landlord2.set_password("password123")

    landlord3 = User(email="moshe@example.com", first_name="משה", last_name="אברהם",
                     phone="052-9876543", age=50, gender="male", city="חיפה", role="landlord")
    landlord3.set_password("password123")

    tenant1 = User(email="yael@example.com", first_name="יעל", last_name="ישראלי",
                   phone="054-1112222", age=26, gender="female", city="תל אביב", role="tenant")
    tenant1.set_password("password123")

    tenant2 = User(email="omer@example.com", first_name="עומר", last_name="דהן",
                   phone="053-3334444", age=29, gender="male", city="תל אביב", role="roommate")
    tenant2.set_password("password123")

    db.session.add_all([landlord1, landlord2, landlord3, tenant1, tenant2])
    db.session.flush()

    db.session.add_all([
        UserPreferences(
            user_id=tenant1.id, preferred_city="תל אביב", max_rent=6000,
            smoking="no", pets=False, move_in_date=date(2026, 4, 1),
            cleanliness_level=4, noise_level="moderate", sleep_schedule="normal",
            preferred_gender="any",
        ),
        UserPreferences(
            user_id=tenant2.id, preferred_city="תל אביב", max_rent=4000,
            smoking="outdoor", pets=True, move_in_date=date(2026, 3, 15),
            cleanliness_level=3, noise_level="social", sleep_schedule="night",
            preferred_gender="male",
        ),
    ])

    properties_data = [
        dict(landlord_id=landlord1.id, title="דירת 3 חדרים מרווחת בלב תל אביב",
             description="דירה מרווחת ומוארת עם מרפסת שמש, קרובה לים ולתחבורה ציבורית.",
             city="תל אביב", neighborhood="הצפון הישן", address="רחוב דיזנגוף 120",
             property_type="apartment", rooms=3, floor=4, size_sqm=85,
             rent_price=5500, furnished=True, parking=False, elevator=True,
             balcony=True, ac=True, storage=False, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 4, 1), min_rental_months=12),
        dict(landlord_id=landlord1.id, title="סטודיו מעוצב ליד רוטשילד",
             description="סטודיו קטן ומעוצב, מושלם לסטודנט או עובד צעיר.",
             city="תל אביב", neighborhood="לב העיר", address="רחוב רוטשילד 50",
             property_type="studio", rooms=1, floor=2, size_sqm=35,
             rent_price=4200, furnished=True, parking=False, elevator=False,
             balcony=False, ac=True, storage=False, pets_allowed=True,
             smoking_allowed=False, available_from=date(2026, 3, 15), min_rental_months=6),
        dict(landlord_id=landlord2.id, title="דירת 4 חדרים בבקעה ירושלים",
             description="דירה משפחתית רחבת ידיים עם נוף לחומות העיר העתיקה.",
             city="ירושלים", neighborhood="בקעה", address="רחוב רחל אמנו 15",
             property_type="apartment", rooms=4, floor=1, size_sqm=110,
             rent_price=4800, furnished=False, parking=True, elevator=False,
             balcony=True, ac=True, storage=True, pets_allowed=True,
             smoking_allowed=False, available_from=date(2026, 3, 20), min_rental_months=12),
        dict(landlord_id=landlord2.id, title="חדר בדירת שותפים ברחביה",
             description="חדר גדול ומרוהט בדירת 4 חדרים. 2 שותפים נוספים.",
             city="ירושלים", neighborhood="רחביה", address="רחוב עזה 30",
             property_type="room", rooms=1, floor=3, size_sqm=18,
             rent_price=2200, furnished=True, parking=False, elevator=True,
             balcony=False, ac=True, storage=False, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 3, 10), min_rental_months=6,
             roommate_gender="female", max_roommates=3),
        dict(landlord_id=landlord3.id, title="דירת גן 3 חדרים בכרמל",
             description="דירת גן עם גינה פרטית ענקית, מתאימה למשפחה.",
             city="חיפה", neighborhood="כרמל מרכזי", address="רחוב הנשיא 45",
             property_type="apartment", rooms=3, floor=0, size_sqm=90,
             rent_price=3800, furnished=False, parking=True, elevator=False,
             balcony=True, ac=True, storage=True, pets_allowed=True,
             smoking_allowed=True, available_from=date(2026, 4, 15), min_rental_months=12),
        dict(landlord_id=landlord3.id, title="פנטהאוז מפואר בחיפה עם נוף לים",
             description="פנטהאוז 5 חדרים עם מרפסת ענקית ונוף פנורמי לים.",
             city="חיפה", neighborhood="כרמל צרפתי", address="שדרות הנשיא 100",
             property_type="apartment", rooms=5, floor=12, size_sqm=160,
             rent_price=8500, furnished=True, parking=True, elevator=True,
             balcony=True, ac=True, storage=True, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 5, 1), min_rental_months=12),
        dict(landlord_id=landlord1.id, title="דירת 2 חדרים בפלורנטין",
             description="דירה צעירה ואנרגטית בלב פלורנטין.",
             city="תל אביב", neighborhood="פלורנטין", address="רחוב ויטל 8",
             property_type="apartment", rooms=2, floor=3, size_sqm=55,
             rent_price=4800, furnished=True, parking=False, elevator=False,
             balcony=True, ac=True, storage=False, pets_allowed=True,
             smoking_allowed=True, available_from=date(2026, 3, 25), min_rental_months=12),
        dict(landlord_id=landlord2.id, title="בית פרטי בראשון לציון",
             description="בית פרטי עם חצר, 4 חדרים, מתאים למשפחה.",
             city="ראשון לציון", neighborhood="נווה הדרים", address="רחוב הדקלים 22",
             property_type="house", rooms=4, floor=0, size_sqm=140,
             rent_price=6500, furnished=False, parking=True, elevator=False,
             balcony=False, ac=True, storage=True, pets_allowed=True,
             smoking_allowed=False, available_from=date(2026, 4, 10), min_rental_months=12),
        dict(landlord_id=landlord3.id, title="חדר בשותפות ברמת גן",
             description="חדר מרוהט בדירת 3 חדרים ליד הבורסה.",
             city="רמת גן", neighborhood="בורסה", address="רחוב ז'בוטינסקי 60",
             property_type="room", rooms=1, floor=8, size_sqm=15,
             rent_price=2800, furnished=True, parking=True, elevator=True,
             balcony=False, ac=True, storage=False, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 3, 15), min_rental_months=6,
             roommate_gender="male", max_roommates=2),
        dict(landlord_id=landlord1.id, title="דירת 3.5 חדרים בנווה שאנן תל אביב",
             description="דירה מרווחת ושקטה, מושלמת לזוג.",
             city="תל אביב", neighborhood="נווה שאנן", address="רחוב שלמה המלך 35",
             property_type="apartment", rooms=3.5, floor=5, size_sqm=95,
             rent_price=5200, furnished=False, parking=True, elevator=True,
             balcony=True, ac=True, storage=True, pets_allowed=False,
             smoking_allowed=False, available_from=date(2026, 4, 1), min_rental_months=12),
    ]
    props = [Property(**pdata) for pdata in properties_data]
    db.session.add_all(props)
    db.session.flush()

    # Attach seed photos. Auto-generate on first boot if the gradient images
    # aren't already on disk. See scripts/gen_seed_images.py for the full
    # branding pipeline.
    import os, subprocess, sys
    images_dir = os.path.join(
        os.path.dirname(__file__), "static", "uploads", "properties"
    )
    if not os.path.exists(os.path.join(images_dir, "seed_00.webp")):
        try:
            subprocess.run(
                [sys.executable, os.path.join(os.path.dirname(__file__), "scripts", "gen_seed_images.py")],
                check=True, capture_output=True,
            )
        except Exception:
            pass  # non-fatal — cards will just show the emoji fallback

    for i, prop in enumerate(props):
        for j in range(2 + (i % 2)):  # 2 or 3 images per property
            idx = (i + j) % 10
            name = f"seed_{idx:02d}.webp"
            if not os.path.exists(os.path.join(images_dir, name)):
                continue
            db.session.add(PropertyImage(
                property_id=prop.id,
                image_url=f"/static/uploads/properties/{name}",
                thumb_url=f"/static/uploads/properties/thumbs/{name}",
                is_primary=(j == 0),
                order=j,
            ))

    db.session.commit()
