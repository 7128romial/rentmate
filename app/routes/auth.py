"""Auth — phone OTP via Twilio, multi-role selection, profile completion.

Flow:
  /auth/login        — enter phone → POST sends OTP, redirects to /auth/verify
  /auth/verify       — enter 6-digit code → success marks is_verified and
                       either redirects to /auth/roles (new user) or home
  /auth/roles        — choose one-or-more active roles
  /auth/profile      — first/last name, birth date, bio, photo
  /auth/logout
"""

from datetime import datetime

from flask import (
    Blueprint, render_template, request, redirect, url_for, session, flash,
    current_app,
)
from flask_login import login_user, logout_user, login_required, current_user

from app.extensions import db, limiter
from app.models import User, UserRole, RoleType, Gender
from app.services.twilio_service import send_otp, check_otp
from app.utils.validators import normalize_phone, is_valid_name

bp = Blueprint("auth", __name__)


# ---------------------------------------------------------------------------
# Phone entry -> send OTP
# ---------------------------------------------------------------------------

@bp.route("/login", methods=["GET", "POST"])
@limiter.limit("10 per minute", methods=["POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("matches.swipe"))

    if request.method == "POST":
        raw_phone = (request.form.get("phone") or "").strip()
        phone = normalize_phone(raw_phone)
        if not phone:
            flash("מספר טלפון לא תקין. הקלידו בפורמט 05X-XXXXXXX", "error")
            return render_template("auth/login.html", phone=raw_phone)

        result = send_otp(phone)
        if not result.ok:
            flash(f"שליחת קוד אימות נכשלה: {result.detail or result.status}", "error")
            return render_template("auth/login.html", phone=raw_phone)

        session["pending_phone"] = phone
        session["pending_phone_display"] = raw_phone
        if result.detail == "dev-fallback":
            flash("מצב פיתוח: השתמשו בקוד 000000", "info")
        return redirect(url_for("auth.verify"))

    return render_template("auth/login.html")


# ---------------------------------------------------------------------------
# OTP verification
# ---------------------------------------------------------------------------

@bp.route("/verify", methods=["GET", "POST"])
@limiter.limit("20 per minute", methods=["POST"])
def verify():
    phone = session.get("pending_phone")
    if not phone:
        return redirect(url_for("auth.login"))

    if request.method == "POST":
        code = (request.form.get("code") or "").strip()
        if not code.isdigit() or len(code) != 6:
            flash("הקוד חייב להיות 6 ספרות", "error")
            return render_template("auth/verify.html", phone=session.get("pending_phone_display"))

        result = check_otp(phone, code)
        if not result.ok:
            flash("הקוד שגוי או פג תוקף. נסו שוב.", "error")
            return render_template("auth/verify.html", phone=session.get("pending_phone_display"))

        # Find or create user
        user = User.query.filter_by(phone=phone).first()
        is_new = False
        if not user:
            user = User(phone=phone, is_verified=True)
            db.session.add(user)
            db.session.commit()
            is_new = True
        else:
            if not user.is_verified:
                user.is_verified = True
                db.session.commit()

        session.pop("pending_phone", None)
        session.pop("pending_phone_display", None)
        login_user(user, remember=True)

        if is_new or not user.active_roles:
            return redirect(url_for("auth.choose_roles"))
        if not (user.first_name and user.last_name):
            return redirect(url_for("auth.complete_profile"))
        return redirect(url_for("matches.swipe"))

    return render_template("auth/verify.html", phone=session.get("pending_phone_display"))


@bp.route("/resend-code", methods=["POST"])
@limiter.limit("3 per minute")
def resend_code():
    phone = session.get("pending_phone")
    if not phone:
        return redirect(url_for("auth.login"))
    result = send_otp(phone)
    if result.ok:
        flash("קוד אימות חדש נשלח", "success")
    else:
        flash("שליחה נכשלה. נסו שוב.", "error")
    return redirect(url_for("auth.verify"))


# ---------------------------------------------------------------------------
# Role selection
# ---------------------------------------------------------------------------

@bp.route("/roles", methods=["GET", "POST"])
@login_required
def choose_roles():
    if request.method == "POST":
        selected_raw = request.form.getlist("roles")
        selected = [RoleType(r) for r in selected_raw if r in {rt.value for rt in RoleType}]
        if not selected:
            flash("בחרו לפחות תפקיד אחד כדי להמשיך", "error")
            return render_template("auth/roles.html", selected=[])

        # Wipe + recreate to make this idempotent (so user can come back and edit)
        UserRole.query.filter_by(user_id=current_user.id).delete()
        for r in selected:
            db.session.add(UserRole(user_id=current_user.id, role=r, is_active=True))
        db.session.commit()

        if not (current_user.first_name and current_user.last_name):
            return redirect(url_for("auth.complete_profile"))
        # Send tenants/roommates into the AI interview
        if {RoleType.TENANT, RoleType.ROOMMATE} & {r for r in selected}:
            return redirect(url_for("ai_agent.chat"))
        return redirect(url_for("dashboard.landlord"))

    return render_template(
        "auth/roles.html",
        selected=[r.role.value for r in current_user.roles if r.is_active],
    )


# ---------------------------------------------------------------------------
# Profile completion (first time only)
# ---------------------------------------------------------------------------

@bp.route("/profile", methods=["GET", "POST"])
@login_required
def complete_profile():
    if request.method == "POST":
        first = (request.form.get("first_name") or "").strip()
        last = (request.form.get("last_name") or "").strip()
        bio = (request.form.get("bio") or "").strip()[:500]
        gender_raw = (request.form.get("gender") or "").strip()
        bd = (request.form.get("birth_date") or "").strip()

        errors = []
        if not is_valid_name(first): errors.append("שם פרטי חסר או ארוך מדי")
        if not is_valid_name(last): errors.append("שם משפחה חסר או ארוך מדי")
        if errors:
            for e in errors: flash(e, "error")
            return render_template("auth/complete_profile.html", user=current_user)

        current_user.first_name = first
        current_user.last_name = last
        current_user.bio = bio
        if gender_raw in {g.value for g in Gender}:
            current_user.gender = Gender(gender_raw)
        if bd:
            try:
                current_user.birth_date = datetime.strptime(bd, "%Y-%m-%d").date()
            except ValueError:
                pass
        db.session.commit()
        flash("הפרופיל נשמר. בוא נבנה העדפות חיפוש!", "success")
        # Tenants / roommates → AI interview; landlords → their dashboard
        if current_user.has_role(RoleType.TENANT) or current_user.has_role(RoleType.ROOMMATE):
            return redirect(url_for("ai_agent.chat"))
        return redirect(url_for("dashboard.landlord"))

    return render_template("auth/complete_profile.html", user=current_user)


@bp.route("/logout")
@login_required
def logout():
    logout_user()
    flash("התנתקת בהצלחה", "success")
    return redirect(url_for("landing.home"))
