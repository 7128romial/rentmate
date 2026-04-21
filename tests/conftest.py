"""Shared pytest fixtures."""

import os
import sys

import pytest

# Ensure project root on sys.path so `from rentmate import create_app` works
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ.setdefault("FLASK_ENV", "test")
os.environ.setdefault("SECRET_KEY", "test-secret")


@pytest.fixture
def app():
    from config import TestConfig
    from rentmate import create_app
    from rentmate.extensions import db

    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db_session(app):
    from rentmate.extensions import db
    return db.session


@pytest.fixture
def make_user(db_session):
    from models import User, UserPreferences

    def _make(**kwargs):
        defaults = {
            "email": "u@example.com",
            "first_name": "U",
            "last_name": "One",
            "role": "tenant",
        }
        defaults.update(kwargs)
        password = defaults.pop("password", "password123")
        user = User(**defaults)
        user.set_password(password)
        db_session.add(user)
        db_session.flush()
        db_session.add(UserPreferences(user_id=user.id))
        db_session.commit()
        return user

    return _make


@pytest.fixture
def authed_client(client, make_user):
    user = make_user(email="me@example.com")
    client.post("/login", data={"email": user.email, "password": "password123"},
                follow_redirects=False)
    return client, user
