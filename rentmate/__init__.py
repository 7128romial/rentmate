"""RentMate Flask application factory."""

import os

from flask import Flask
from flask_login import LoginManager

from config import Config, get_config
from rentmate.extensions import (
    db,
    bcrypt,
    migrate,
    socketio,
    limiter,
    mail,
)

login_manager = LoginManager()
login_manager.login_view = "auth.login"


def create_app(config_class=None):
    app = Flask(
        __name__,
        static_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "static"),
        template_folder=os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates"),
    )
    cfg = config_class or get_config()
    app.config.from_object(cfg)

    db.init_app(app)
    bcrypt.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)

    socketio_kwargs = {
        "cors_allowed_origins": "*",
        "async_mode": app.config.get("SOCKETIO_ASYNC_MODE", "eventlet"),
    }
    if app.config.get("SOCKETIO_MESSAGE_QUEUE"):
        socketio_kwargs["message_queue"] = app.config["SOCKETIO_MESSAGE_QUEUE"]
    socketio.init_app(app, **socketio_kwargs)

    from models import User  # noqa: E402

    @login_manager.user_loader
    def _load_user(user_id):
        return db.session.get(User, int(user_id))

    from rentmate.blueprints.auth import bp as auth_bp
    from rentmate.blueprints.properties import bp as properties_bp
    from rentmate.blueprints.matches import bp as matches_bp
    from rentmate.blueprints.profile import bp as profile_bp
    from rentmate.blueprints.chat import bp as chat_bp
    from rentmate.blueprints.uploads import bp as uploads_bp
    from rentmate.blueprints.notifications import bp as notifications_bp
    from rentmate.blueprints.core import bp as core_bp

    app.register_blueprint(core_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(properties_bp)
    app.register_blueprint(matches_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(notifications_bp)

    # Register Socket.IO handlers
    from rentmate.blueprints import sockets  # noqa: F401

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "properties"), exist_ok=True)
    os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "properties", "thumbs"), exist_ok=True)
    os.makedirs(os.path.join(app.config["UPLOAD_FOLDER"], "avatars"), exist_ok=True)

    with app.app_context():
        db.create_all()
        if not app.config.get("TESTING"):
            from seed import seed_if_empty
            seed_if_empty()

    return app
