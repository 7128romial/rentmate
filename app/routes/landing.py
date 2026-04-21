"""Landing page + error pages."""

from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user

from app.models import Listing, ListingStatus

bp = Blueprint("landing", __name__)


@bp.route("/")
def home():
    if current_user.is_authenticated:
        return redirect(url_for("matches.swipe"))
    active_count = Listing.query.filter_by(status=ListingStatus.ACTIVE).count()
    return render_template("landing.html", active_listings=active_count)
