"""Landing page + PWA asset routes."""

from flask import Blueprint, render_template, send_from_directory, current_app
import os

from models import Property

bp = Blueprint("core", __name__)


@bp.route("/")
def landing():
    count = Property.query.filter_by(status="active").count()
    return render_template("landing.html", listing_count=count)


@bp.route("/offline")
def offline():
    return render_template("offline.html")


@bp.route("/service-worker.js")
def service_worker():
    # Serve from /static but at a path with site-wide scope
    return send_from_directory(
        os.path.join(current_app.root_path, "..", "static"),
        "service-worker.js",
        mimetype="application/javascript",
    )


@bp.route("/manifest.webmanifest")
def manifest():
    return send_from_directory(
        os.path.join(current_app.root_path, "..", "static"),
        "manifest.webmanifest",
        mimetype="application/manifest+json",
    )
