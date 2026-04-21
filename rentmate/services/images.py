"""Image upload pipeline — validate with Pillow, strip EXIF, resize to webp."""

import os
import uuid

from PIL import Image, UnidentifiedImageError
from flask import current_app, url_for


MAIN_MAX = 1600
THUMB_MAX = 400


class InvalidImage(Exception):
    pass


def _ext_allowed(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_IMAGE_EXTENSIONS"]


def save_property_image(file_storage, property_id):
    """Returns (image_url, thumb_url) as static-relative paths. Raises InvalidImage."""
    return _save(file_storage, "properties", sub_id=str(property_id))


def save_avatar(file_storage, user_id):
    return _save(file_storage, "avatars", sub_id=str(user_id))


def _save(file_storage, kind, sub_id):
    if not file_storage or not file_storage.filename:
        raise InvalidImage("no file")
    if not _ext_allowed(file_storage.filename):
        raise InvalidImage("extension not allowed")

    try:
        img = Image.open(file_storage.stream)
        img.verify()
    except (UnidentifiedImageError, Exception) as e:
        raise InvalidImage(f"invalid image: {e}")

    # Reopen because verify() consumes the stream
    file_storage.stream.seek(0)
    img = Image.open(file_storage.stream)

    # Strip EXIF by re-constructing via convert
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    upload_root = current_app.config["UPLOAD_FOLDER"]
    folder = os.path.join(upload_root, kind)
    thumb_folder = os.path.join(folder, "thumbs")
    os.makedirs(folder, exist_ok=True)
    os.makedirs(thumb_folder, exist_ok=True)

    name = f"{sub_id}_{uuid.uuid4().hex}.webp"
    main_path = os.path.join(folder, name)
    thumb_path = os.path.join(thumb_folder, name)

    main = img.copy()
    main.thumbnail((MAIN_MAX, MAIN_MAX))
    main.save(main_path, "WEBP", quality=85, method=6)

    thumb = img.copy()
    thumb.thumbnail((THUMB_MAX, THUMB_MAX))
    thumb.save(thumb_path, "WEBP", quality=80, method=6)

    return (
        url_for("static", filename=f"uploads/{kind}/{name}"),
        url_for("static", filename=f"uploads/{kind}/thumbs/{name}"),
        name,
    )


def delete_image_files(image_url, thumb_url):
    """Best-effort deletion of the underlying files."""
    upload_root = current_app.config["UPLOAD_FOLDER"]
    for u in (image_url, thumb_url):
        if not u:
            continue
        # Map /static/uploads/... to real path
        try:
            # Extract tail after /static/uploads/
            idx = u.find("/static/uploads/")
            if idx == -1:
                continue
            tail = u[idx + len("/static/uploads/"):]
            path = os.path.join(upload_root, tail)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
