"""Twilio Verify wrapper — sends and checks SMS OTPs.

In development (no credentials set), the service logs the OTP to the Flask
logger and accepts the code `000000`. This lets you develop the auth flow
without burning SMS quota. Never leave dev fallback enabled in production —
ProductionConfig asserts SECRET_KEY, and Twilio creds must be set separately.
"""

import logging
from dataclasses import dataclass

from flask import current_app

logger = logging.getLogger(__name__)


class TwilioNotConfigured(RuntimeError):
    pass


@dataclass
class VerifyResult:
    ok: bool
    status: str
    detail: str = ""


def _client():
    sid = current_app.config.get("TWILIO_ACCOUNT_SID")
    token = current_app.config.get("TWILIO_AUTH_TOKEN")
    if not (sid and token):
        return None
    from twilio.rest import Client
    return Client(sid, token)


def _service_sid():
    svc = current_app.config.get("TWILIO_VERIFY_SERVICE_SID")
    if not svc:
        raise TwilioNotConfigured("TWILIO_VERIFY_SERVICE_SID missing")
    return svc


def send_otp(phone_e164):
    """Send a verification code to the phone. Returns VerifyResult."""
    client = _client()
    if client is None:
        logger.warning(
            "Twilio not configured — DEV FALLBACK: pretend we sent an OTP to %s. "
            "Use code 000000 to continue.", phone_e164,
        )
        return VerifyResult(ok=True, status="pending", detail="dev-fallback")

    try:
        verification = client.verify.v2.services(_service_sid()).verifications.create(
            to=phone_e164, channel="sms",
        )
        return VerifyResult(ok=True, status=verification.status)
    except Exception as e:
        logger.exception("Twilio send_otp failed")
        return VerifyResult(ok=False, status="error", detail=str(e))


def check_otp(phone_e164, code):
    """Verify a user-supplied code. Returns VerifyResult."""
    client = _client()
    if client is None:
        # Dev fallback — only the magic code is accepted.
        ok = code == "000000"
        return VerifyResult(
            ok=ok,
            status="approved" if ok else "denied",
            detail="dev-fallback (use 000000)" if not ok else "",
        )

    try:
        check = client.verify.v2.services(_service_sid()).verification_checks.create(
            to=phone_e164, code=code,
        )
        return VerifyResult(ok=(check.status == "approved"), status=check.status)
    except Exception as e:
        logger.exception("Twilio check_otp failed")
        return VerifyResult(ok=False, status="error", detail=str(e))
