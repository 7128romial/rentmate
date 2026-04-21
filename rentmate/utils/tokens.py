"""Short-lived signed tokens used for email verification + password reset."""

from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from flask import current_app


def _serializer(salt):
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=salt)


def make_token(payload, salt):
    return _serializer(salt).dumps(payload)


def read_token(token, salt, max_age=86400):
    try:
        return _serializer(salt).loads(token, max_age=max_age)
    except (BadSignature, SignatureExpired):
        return None
