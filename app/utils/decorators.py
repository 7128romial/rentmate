"""Route decorators."""

from functools import wraps

from flask import abort, jsonify, request
from flask_login import current_user


def role_required(*required_roles):
    """Require the current user to have at least one of the given roles active."""
    def deco(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not current_user.is_authenticated:
                return abort(401)
            active = {r.role.value if hasattr(r.role, "value") else r.role
                      for r in current_user.roles if r.is_active}
            wanted = {r.value if hasattr(r, "value") else r for r in required_roles}
            if not (active & wanted):
                return abort(403)
            return fn(*args, **kwargs)
        return wrapper
    return deco


def json_required(fn):
    """Reject requests that aren't JSON; parse body into request.json_payload."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        data = request.get_json(silent=True)
        if data is None:
            return jsonify({"error": "expected JSON body"}), 400
        request.json_payload = data
        return fn(*args, **kwargs)
    return wrapper
