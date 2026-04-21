"""Cloudinary upload wrapper — falls back to local storage in dev."""

import logging
import os
import uuid

from flask import current_app

logger = logging.getLogger(__name__)


def _configured():
    c = current_app.config
    return all([c.get("CLOUDINARY_CLOUD_NAME"), c.get("CLOUDINARY_API_KEY"), c.get("CLOUDINARY_API_SECRET")])


def upload_image(file_storage, folder="rentmate/listings"):
    """Upload to Cloudinary, or save locally if not configured.

    Returns the public image URL.
    """
    if _configured():
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=current_app.config["CLOUDINARY_CLOUD_NAME"],
            api_key=current_app.config["CLOUDINARY_API_KEY"],
            api_secret=current_app.config["CLOUDINARY_API_SECRET"],
            secure=True,
        )
        try:
            result = cloudinary.uploader.upload(
                file_storage, folder=folder,
                transformation=[{"width": 1600, "height": 1066, "crop": "limit", "quality": "auto", "fetch_format": "auto"}],
            )
            return result["secure_url"]
        except Exception:
            logger.exception("Cloudinary upload failed, falling back to local")

    # Local fallback
    upload_root = current_app.config["UPLOAD_FOLDER"]
    subdir = folder.split("/")[-1]
    target_dir = os.path.join(upload_root, subdir)
    os.makedirs(target_dir, exist_ok=True)

    ext = os.path.splitext(file_storage.filename or "")[1].lower() or ".jpg"
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(target_dir, name)

    # Pillow sanitize + resize
    try:
        from PIL import Image
        img = Image.open(file_storage.stream)
        img.verify()
        file_storage.stream.seek(0)
        img = Image.open(file_storage.stream)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.thumbnail((1600, 1600))
        img.save(path, "WEBP" if ext == ".webp" else "JPEG", quality=85)
        return f"/static/uploads/{subdir}/{name}"
    except Exception:
        logger.exception("local image save failed")
        return None
