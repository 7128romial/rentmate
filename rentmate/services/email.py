"""Email sending — async via background thread so requests aren't blocked."""

import threading

from flask import current_app, render_template
from flask_mail import Message as MailMessage

from rentmate.extensions import mail


def _send_async(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            app.logger.warning("email send failed: %s", e)


def send_email(to, subject, template, **context):
    app = current_app._get_current_object()
    if app.config.get("MAIL_SUPPRESS_SEND"):
        return
    html = render_template(f"emails/{template}.html", **context)
    msg = MailMessage(
        subject=subject,
        recipients=[to],
        html=html,
        sender=app.config["MAIL_DEFAULT_SENDER"],
    )
    threading.Thread(target=_send_async, args=(app, msg), daemon=True).start()
