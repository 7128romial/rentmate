"""Dev entry point — runs the Socket.IO-aware server."""

from rentmate import create_app
from rentmate.extensions import socketio


app = create_app()

if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
