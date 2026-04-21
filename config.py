import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "rentmate-dev-secret-key-change-in-prod")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", f"sqlite:///{os.path.join(BASE_DIR, 'rentmate.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32 MB upload limit (multi-image forms)
    UPLOAD_FOLDER = os.environ.get(
        "UPLOAD_FOLDER", os.path.join(BASE_DIR, "static", "uploads")
    )
    ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}

    # Socket.IO — Redis message queue is wired but not required for single-instance deploy
    SOCKETIO_MESSAGE_QUEUE = os.environ.get("REDIS_URL") or None
    SOCKETIO_ASYNC_MODE = os.environ.get("SOCKETIO_ASYNC_MODE", "eventlet")

    # Mail
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "localhost")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 1025))
    MAIL_USE_TLS = os.environ.get("MAIL_USE_TLS", "false").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "no-reply@rentmate.local")
    MAIL_SUPPRESS_SEND = False

    # Rate limiting
    RATELIMIT_DEFAULT = "200 per hour;50 per minute"
    RATELIMIT_STORAGE_URI = os.environ.get("REDIS_URL") or "memory://"

    # App URLs used inside email links
    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5000")


class DevConfig(Config):
    DEBUG = True


class ProdConfig(Config):
    DEBUG = False

    def __init__(self):
        if os.environ.get("SECRET_KEY") in (None, "", "rentmate-dev-secret-key-change-in-prod"):
            raise RuntimeError("SECRET_KEY must be set in production")


class TestConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    WTF_CSRF_ENABLED = False
    MAIL_SUPPRESS_SEND = True
    RATELIMIT_ENABLED = False
    SOCKETIO_MESSAGE_QUEUE = None


CONFIG_MAP = {
    "dev": DevConfig,
    "prod": ProdConfig,
    "test": TestConfig,
}


def get_config(name=None):
    name = name or os.environ.get("FLASK_ENV", "dev")
    cls = CONFIG_MAP.get(name, DevConfig)
    return cls() if isinstance(cls, type) and cls is ProdConfig else cls
