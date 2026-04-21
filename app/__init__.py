"""RentMate application factory."""

import logging
import os

from flask import Flask, render_template

from config import get_config
from app.extensions import db, login_manager, csrf, migrate, limiter


def create_app(config_object=None):
    app = Flask(__name__, static_folder="static", template_folder="templates")
    app.config.from_object(config_object or get_config())

    _configure_logging(app)

    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)
    login_manager.init_app(app)
    limiter.init_app(app)

    from app.models import User  # noqa: E402  (ensure models are importable)

    @login_manager.user_loader
    def _load_user(user_id):
        return db.session.get(User, int(user_id))

    # Inject client-side Firebase config + Google Maps key into every template
    @app.context_processor
    def _inject_public_config():
        return {
            "firebase_client_config": {
                "apiKey": app.config.get("FIREBASE_API_KEY"),
                "authDomain": app.config.get("FIREBASE_AUTH_DOMAIN"),
                "projectId": app.config.get("FIREBASE_PROJECT_ID"),
                "messagingSenderId": app.config.get("FIREBASE_MESSAGING_SENDER_ID"),
                "appId": app.config.get("FIREBASE_APP_ID"),
                "vapidKey": app.config.get("FIREBASE_VAPID_KEY"),
            },
            "google_maps_api_key": app.config.get("GOOGLE_MAPS_API_KEY"),
        }

    # Register all blueprints
    from app.routes.landing import bp as landing_bp
    from app.routes.auth import bp as auth_bp
    from app.routes.ai_agent import bp as ai_bp
    from app.routes.apartments import bp as apartments_bp
    from app.routes.listings import bp as listings_bp
    from app.routes.matches import bp as matches_bp
    from app.routes.chat import bp as chat_bp
    from app.routes.profile import bp as profile_bp
    from app.routes.notifications import bp as notifications_bp
    from app.routes.dashboard import bp as dashboard_bp

    app.register_blueprint(landing_bp)
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(ai_bp, url_prefix="/ai")
    app.register_blueprint(apartments_bp, url_prefix="/apartments")
    app.register_blueprint(listings_bp, url_prefix="/listings")
    app.register_blueprint(matches_bp)
    app.register_blueprint(chat_bp, url_prefix="/chat")
    app.register_blueprint(profile_bp, url_prefix="/profile")
    app.register_blueprint(notifications_bp, url_prefix="/notifications")
    app.register_blueprint(dashboard_bp, url_prefix="/dashboard")

    @app.errorhandler(404)
    def _not_found(e):
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def _server_error(e):
        app.logger.exception("internal error: %s", e)
        return render_template("errors/500.html"), 500

    # Ensure upload folders exist for local dev fallbacks
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    with app.app_context():
        db.create_all()

    return app


def _configure_logging(app):
    """Structured logging — stdout in dev, file in prod."""
    level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    app.logger.setLevel(level)
