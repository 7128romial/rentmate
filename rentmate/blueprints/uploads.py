"""Image upload endpoints for property photos and user avatars."""

from flask import Blueprint, request, jsonify, abort
from flask_login import login_required, current_user

from rentmate.extensions import db, limiter
from rentmate.services.images import (
    save_property_image, save_avatar, delete_image_files, InvalidImage,
)
from models import Property, PropertyImage

bp = Blueprint("uploads", __name__)

MAX_IMAGES_PER_PROPERTY = 10


@bp.route("/api/properties/<int:property_id>/images", methods=["POST"])
@login_required
@limiter.limit("20 per hour")
def upload_property_images(property_id):
    prop = db.session.get(Property, property_id)
    if not prop or prop.landlord_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    existing_count = PropertyImage.query.filter_by(property_id=property_id).count()
    files = request.files.getlist("images") or []
    if not files:
        return jsonify({"error": "no files provided"}), 400
    if existing_count + len(files) > MAX_IMAGES_PER_PROPERTY:
        return jsonify({"error": f"max {MAX_IMAGES_PER_PROPERTY} images per property"}), 400

    created = []
    for i, f in enumerate(files):
        try:
            img_url, thumb_url, _name = save_property_image(f, property_id)
        except InvalidImage as e:
            return jsonify({"error": str(e)}), 422
        order = existing_count + i
        row = PropertyImage(
            property_id=property_id,
            image_url=img_url,
            thumb_url=thumb_url,
            is_primary=(existing_count == 0 and i == 0),
            order=order,
        )
        db.session.add(row)
        created.append(row)
    db.session.commit()

    return jsonify({
        "images": [{
            "id": r.id, "url": r.image_url, "thumb": r.thumb_url,
            "is_primary": r.is_primary, "order": r.order,
        } for r in created]
    })


@bp.route("/api/images/<int:image_id>", methods=["DELETE"])
@login_required
def delete_property_image(image_id):
    img = db.session.get(PropertyImage, image_id)
    if not img:
        return jsonify({"error": "not found"}), 404
    prop = db.session.get(Property, img.property_id)
    if not prop or prop.landlord_id != current_user.id:
        return jsonify({"error": "forbidden"}), 403

    delete_image_files(img.image_url, img.thumb_url)
    was_primary = img.is_primary
    db.session.delete(img)
    db.session.commit()

    if was_primary:
        next_img = PropertyImage.query.filter_by(property_id=prop.id).order_by(
            PropertyImage.order.asc()
        ).first()
        if next_img:
            next_img.is_primary = True
            db.session.commit()

    return jsonify({"ok": True})


@bp.route("/api/profile/avatar", methods=["POST"])
@login_required
@limiter.limit("10 per hour")
def upload_avatar():
    f = request.files.get("avatar")
    if not f:
        return jsonify({"error": "no file"}), 400
    try:
        img_url, _thumb_url, name = save_avatar(f, current_user.id)
    except InvalidImage as e:
        return jsonify({"error": str(e)}), 422
    current_user.avatar_filename = name
    db.session.commit()
    return jsonify({"avatar_url": img_url})
