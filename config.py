"""Configuration classes — selected via FLASK_ENV."""

import os

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class BaseConfig:
    SECRET_KEY = os.environ.get("SECRET_KEY", "rentmate-dev-secret")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    WTF_CSRF_ENABLED = True
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 30  # 30 days
    MAX_CONTENT_LENGTH = 32 * 1024 * 1024  # 32 MB upload ceiling

    APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:5000")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "app", "static", "uploads")

    # Third-party credentials (all optional in dev; clean errors if missing)
    TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID")
    TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN")
    TWILIO_VERIFY_SERVICE_SID = os.environ.get("TWILIO_VERIFY_SERVICE_SID")

    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
    OPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")

    FIREBASE_CREDENTIALS_PATH = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID")
    FIREBASE_API_KEY = os.environ.get("FIREBASE_API_KEY")
    FIREBASE_AUTH_DOMAIN = os.environ.get("FIREBASE_AUTH_DOMAIN")
    FIREBASE_MESSAGING_SENDER_ID = os.environ.get("FIREBASE_MESSAGING_SENDER_ID")
    FIREBASE_APP_ID = os.environ.get("FIREBASE_APP_ID")
    FIREBASE_VAPID_KEY = os.environ.get("FIREBASE_VAPID_KEY")

    CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME")
    CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY")
    CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET")

    RATELIMIT_DEFAULT = "200 per hour;50 per minute"
    RATELIMIT_STORAGE_URI = os.environ.get("REDIS_URL") or "memory://"


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or \
        f"sqlite:///{os.path.join(BASE_DIR, 'rentmate.db')}"


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL")  # required

    def __init__(self):
        if not self.SQLALCHEMY_DATABASE_URI:
            raise RuntimeError("DATABASE_URL must be set in production")
        if os.environ.get("SECRET_KEY") in (None, "", "rentmate-dev-secret"):
            raise RuntimeError("SECRET_KEY must be set to a strong value in production")


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = True
    WTF_CSRF_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    RATELIMIT_ENABLED = False
    SECRET_KEY = "test-secret"


CONFIG_BY_NAME = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def get_config():
    name = os.environ.get("FLASK_ENV", "development").lower()
    cls = CONFIG_BY_NAME.get(name, DevelopmentConfig)
    # Instantiate production to trigger required-var checks
    return cls() if cls is ProductionConfig else cls
