import os
from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
# Use a new DB to avoid conflict with the locked rentmate.db from previous session
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'rentmate_v2.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'rentmate-secret'

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/api/health')
def health():
    return jsonify({"status": "healthy", "version": "v2"})

if __name__ == '__main__':
    # Initialize DB tables
    with app.app_context():
        import models
        db.create_all()
    
    socketio.run(app, debug=True, port=5000)
