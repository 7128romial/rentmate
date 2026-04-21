"""Profile — edit details, toggle roles, redo AI interview, upload avatar."""

from datetime import datetime

from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user

from app.extensions import db
from app.models import User, UserRole, RoleType, Gender
from app.services.cloudinary_service import upload_image

bp = Blueprint("profile", __name__)


@bp.route("/")
@login_required
def view():
    return render_template("profile/view.html", user=current_user)


@bp.route("/edit", methods=["GET", "POST"])
@login_required
def edit():
    if request.method == "POST":
        data = request.form
        current_user.first_name = (data.get("first_name") or current_user.first_name).strip()
        current_user.last_name = (data.get("last_name") or current_user.last_name).strip()
        current_user.bio = (data.get("bio") or "").strip()[:500]
        gender_raw = data.get("gender") or ""
        if gender_raw in {g.value for g in Gender}:
            current_user.gender = Gender(gender_raw)
        bd = data.get("birth_date") or ""
        if bd:
            try:
                current_user.birth_date = datetime.strptime(bd, "%Y-%m-%d").date()
            except ValueError:
                pass
        db.session.commit()
        flash("הפרופיל עודכן", "success")
        return redirect(url_for("profile.view"))
    return render_template("profile/edit.html", user=current_user)


@bp.route("/api/avatar", methods=["POST"])
@login_required
def api_upload_avatar():
    f = request.files.get("avatar")
    if not f:
        return jsonify({"error": "no file"}), 400
    url = upload_image(f, folder="rentmate/avatars")
    if not url:
        return jsonify({"error": "upload failed"}), 500
    current_user.profile_image_url = url
    db.session.commit()
    return jsonify({"avatar_url": url})


@bp.route("/api/roles", methods=["POST"])
@login_required
def api_set_roles():
    data = request.get_json(silent=True) or {}
    roles_raw = data.get("roles") or []
    valid = [RoleType(r) for r in roles_raw if r in {rt.value for rt in RoleType}]
    if not valid:
        return jsonify({"error": "at least one role required"}), 400

    existing = {ur.role: ur for ur in current_user.roles}
    target = set(valid)

    # Create missing
    for r in target - set(existing.keys()):
        db.session.add(UserRole(user_id=current_user.id, role=r, is_active=True))
    # Deactivate removed
    for r, ur in existing.items():
        ur.is_active = r in target
    db.session.commit()
    return jsonify({"ok": True, "active_roles": [r.value for r in target]})
