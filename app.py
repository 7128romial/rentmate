"""RentMate — Swipe. Match. Move In.

Thin shim that creates the Flask app via the factory in `rentmate/`.
For dev: `python run.py`. For prod: `gunicorn -k eventlet -w 1 wsgi:app`.
"""

from rentmate import create_app

app = create_app()


if __name__ == "__main__":
    from rentmate.extensions import socketio
    socketio.run(app, debug=True, port=5000, host="0.0.0.0", allow_unsafe_werkzeug=True)
