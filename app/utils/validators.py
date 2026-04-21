"""Input validators — reused across routes."""

import re

ISRAELI_PHONE_RE = re.compile(r"^(?:\+972|972|0)(5[0-9])\d{7}$")


def normalize_phone(raw):
    """Return E.164 Israeli phone (+9725XXXXXXXX) or None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("0") and len(digits) == 10:
        return "+972" + digits[1:]
    if digits.startswith("972") and len(digits) == 12:
        return "+" + digits
    if raw.startswith("+972") and len(raw) == 13:
        return raw
    return None


def is_valid_israeli_phone(raw):
    return bool(ISRAELI_PHONE_RE.match(re.sub(r"\s|-", "", raw or "")))


def is_valid_name(name):
    return bool(name) and 1 <= len(name.strip()) <= 50


def clamp_int(raw, lo, hi, default=None):
    try:
        v = int(raw)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))
