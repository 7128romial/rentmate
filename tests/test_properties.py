"""Property list + detail smoke tests."""

from datetime import date

from rentmate.extensions import db
from models import Property


def test_api_properties_paginated(client, make_user):
    landlord = make_user(email="ll@example.com", role="landlord")
    for i in range(15):
        db.session.add(Property(
            landlord_id=landlord.id,
            title=f"דירה {i}",
            city="תל אביב",
            property_type="apartment",
            rooms=3, floor=2, size_sqm=60,
            rent_price=4000 + i * 100,
            available_from=date.today(),
        ))
    db.session.commit()

    r = client.get("/api/properties?page=1&per_page=10")
    assert r.status_code == 200
    data = r.get_json()
    assert data["page"] == 1
    assert len(data["items"]) == 10
    assert data["total"] == 15
    assert data["pages"] == 2


def test_api_properties_filter_by_city(client, make_user):
    landlord = make_user(email="ll@example.com", role="landlord")
    db.session.add_all([
        Property(landlord_id=landlord.id, title="תא", city="תל אביב",
                 property_type="apartment", rent_price=4000),
        Property(landlord_id=landlord.id, title="חיפה", city="חיפה",
                 property_type="apartment", rent_price=3000),
    ])
    db.session.commit()

    r = client.get("/api/properties?city=חיפה")
    assert r.status_code == 200
    items = r.get_json()["items"]
    assert len(items) == 1
    assert items[0]["city"] == "חיפה"
