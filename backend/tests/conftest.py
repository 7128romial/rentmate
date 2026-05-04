import os
import sys
import tempfile

import pytest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Set env once before app/models are imported. Subsequent test runs reuse the
# same SQLAlchemy metadata, since redefining models on a fresh `db` would
# conflict with the existing declarative base.
os.environ.setdefault('SECRET_KEY', 'test-secret-key-please-ignore')
os.environ.setdefault('ALLOWED_ORIGIN', '*')
os.environ.setdefault('FLASK_DEBUG', 'true')
os.environ.pop('OPENAI_API_KEY', None)

_db_fd, _db_path = tempfile.mkstemp(suffix='.db')
os.close(_db_fd)
os.environ['DATABASE_URL'] = f'sqlite:///{_db_path}'

import app as app_module  # noqa: E402
import models  # noqa: E402


@pytest.fixture
def app_ctx():
    """Reset the DB and rate-limit state for every test."""
    with app_module.app.app_context():
        app_module.db.session.remove()
        app_module.db.drop_all()
        app_module.db.create_all()
        app_module.seed_demo_properties()

    app_module._chat_rate.clear()
    app_module._login_rate.clear()

    yield app_module, models


@pytest.fixture
def client(app_ctx):
    app_module, _ = app_ctx
    return app_module.app.test_client()
