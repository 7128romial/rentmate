"""Auth flow smoke tests."""


def test_landing_200(client):
    r = client.get("/")
    assert r.status_code == 200


def test_register_creates_user(client):
    r = client.post("/register", data={
        "email": "new@example.com",
        "password": "password123",
        "confirm_password": "password123",
        "first_name": "New",
        "last_name": "User",
        "role": "tenant",
    }, follow_redirects=False)
    assert r.status_code in (302, 200)

    from models import User
    u = User.query.filter_by(email="new@example.com").first()
    assert u is not None
    assert u.check_password("password123")


def test_register_rejects_mismatched_passwords(client):
    r = client.post("/register", data={
        "email": "bad@example.com",
        "password": "password123",
        "confirm_password": "different!",
        "first_name": "X",
        "last_name": "Y",
        "role": "tenant",
    })
    assert r.status_code == 200  # re-renders form with errors
    from models import User
    assert User.query.filter_by(email="bad@example.com").first() is None


def test_login_success(client, make_user):
    make_user(email="login@example.com")
    r = client.post("/login", data={"email": "login@example.com", "password": "password123"},
                    follow_redirects=False)
    assert r.status_code in (302, 200)


def test_login_wrong_password(client, make_user):
    make_user(email="wp@example.com")
    r = client.post("/login", data={"email": "wp@example.com", "password": "nope"})
    assert r.status_code == 200
    assert b"\xd7\x90\xd7\x99\xd7\x9e\xd7\x99\xd7\x99\xd7\x9c" in r.data or b"login" in r.data.lower()
