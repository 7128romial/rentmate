"""Auth: register, login, logout, email verify, password reset."""

from flask import (
    Blueprint, render_template, request, redirect, url_for, flash, current_app,
    jsonify,
)
from flask_login import login_user, logout_user, login_required, current_user
from pydantic import ValidationError

from rentmate.extensions import db, limiter
from rentmate.helpers import ISRAELI_CITIES
from rentmate.schemas import RegisterIn
from rentmate.utils.tokens import make_token, read_token
from rentmate.services.email import send_email
from models import User, UserPreferences

bp = Blueprint("auth", __name__)


@bp.route("/register", methods=["GET", "POST"])
@limiter.limit("5 per hour", methods=["POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("matches.matches"))
    if request.method == "POST":
        try:
            data = RegisterIn(
                email=request.form.get("email", ""),
                password=request.form.get("password", ""),
                confirm_password=request.form.get("confirm_password", ""),
                first_name=request.form.get("first_name", "").strip(),
                last_name=request.form.get("last_name", "").strip(),
                phone=request.form.get("phone", "").strip() or None,
                city=request.form.get("city", "").strip() or None,
                age=request.form.get("age", type=int),
                gender=request.form.get("gender", "").strip() or None,
                role=request.form.get("role", "tenant").strip(),
            )
        except ValidationError as e:
            return render_template(
                "register.html",
                errors=[err["msg"] for err in e.errors()],
                cities=ISRAELI_CITIES,
            )

        if data.password != data.confirm_password:
            return render_template(
                "register.html",
                errors=["הסיסמאות אינן תואמות"],
                cities=ISRAELI_CITIES,
            )
        if User.query.filter_by(email=data.email).first():
            return render_template(
                "register.html",
                errors=["כתובת האימייל כבר רשומה במערכת"],
                cities=ISRAELI_CITIES,
            )

        user = User(
            email=data.email,
            first_name=data.first_name,
            last_name=data.last_name,
            phone=data.phone,
            city=data.city,
            age=data.age,
            gender=data.gender,
            role=data.role,
        )
        user.set_password(data.password)
        db.session.add(user)
        db.session.flush()

        prefs = UserPreferences(user_id=user.id, preferred_city=data.city)
        db.session.add(prefs)
        db.session.commit()

        # Send verification email (non-blocking)
        token = make_token({"uid": user.id}, salt="email-verify")
        verify_url = f"{current_app.config['APP_BASE_URL']}{url_for('auth.verify_email', token=token)}"
        send_email(
            user.email,
            "אימות כתובת האימייל שלך — RentMate",
            "verify_email",
            user=user,
            verify_url=verify_url,
        )

        login_user(user)
        return redirect(url_for("matches.matches"))

    return render_template("register.html", errors=[], cities=ISRAELI_CITIES)


@bp.route("/login", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("matches.matches"))
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        remember = bool(request.form.get("remember"))

        user = User.query.filter_by(email=email).first()
        if user and user.check_password(password):
            login_user(user, remember=remember)
            nxt = request.args.get("next")
            return redirect(nxt or url_for("matches.matches"))
        return render_template("login.html", error="אימייל או סיסמה שגויים")

    return render_template("login.html", error=None)


@bp.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("core.landing"))


@bp.route("/verify/<token>")
def verify_email(token):
    payload = read_token(token, salt="email-verify", max_age=60 * 60 * 24 * 7)
    if not payload:
        return render_template("login.html", error="קישור האימות פג תוקף"), 400
    user = db.session.get(User, payload["uid"])
    if not user:
        return render_template("login.html", error="משתמש לא נמצא"), 404
    user.is_verified = True
    db.session.commit()
    flash("האימייל אומת בהצלחה!", "success")
    return redirect(url_for("auth.login"))


@bp.route("/password/reset/request", methods=["POST"])
@limiter.limit("3 per hour")
def request_password_reset():
    email = (request.get_json(silent=True) or {}).get("email", "").strip().lower()
    user = User.query.filter_by(email=email).first()
    if user:
        token = make_token({"uid": user.id}, salt="password-reset")
        url = f"{current_app.config['APP_BASE_URL']}{url_for('auth.password_reset_form', token=token)}"
        send_email(user.email, "איפוס סיסמה — RentMate", "reset_password", user=user, reset_url=url)
    # Always return 200 to avoid email enumeration
    return jsonify({"ok": True})


@bp.route("/password/reset/<token>", methods=["GET", "POST"])
def password_reset_form(token):
    payload = read_token(token, salt="password-reset", max_age=3600)
    if not payload:
        return render_template("login.html", error="קישור האיפוס פג תוקף"), 400
    if request.method == "POST":
        new_pw = request.form.get("password", "")
        if len(new_pw) < 8:
            return render_template("reset_password.html", error="הסיסמה חייבת להכיל לפחות 8 תווים", token=token)
        user = db.session.get(User, payload["uid"])
        if not user:
            return render_template("login.html", error="משתמש לא נמצא"), 404
        user.set_password(new_pw)
        db.session.commit()
        flash("הסיסמה עודכנה, התחבר עם הסיסמה החדשה", "success")
        return redirect(url_for("auth.login"))
    return render_template("reset_password.html", token=token, error=None)
