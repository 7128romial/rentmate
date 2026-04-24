import os
import sys
import tempfile

import pytest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


@pytest.fixture
def app_ctx(monkeypatch):
    """Load the Flask app with a fresh in-memory SQLite DB for each test."""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(db_fd)

    monkeypatch.setenv('SECRET_KEY', 'test-secret-key-please-ignore')
    monkeypatch.setenv('ALLOWED_ORIGIN', '*')
    monkeypatch.setenv('FLASK_DEBUG', 'true')
    monkeypatch.setenv('EXPOSE_OTP', 'true')
    monkeypatch.setenv('DATABASE_URL', f'sqlite:///{db_path}')
    # Don't actually hit OpenAI during tests.
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)

    # Drop any cached modules so config is re-read.
    for mod in ('app', 'models'):
        sys.modules.pop(mod, None)

    import app as app_module
    import models

    with app_module.app.app_context():
        app_module.db.drop_all()
        app_module.db.create_all()

    yield app_module, models

    with app_module.app.app_context():
        app_module.db.session.remove()
        app_module.db.drop_all()

    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def client(app_ctx):
    app_module, _ = app_ctx
    return app_module.app.test_client()
