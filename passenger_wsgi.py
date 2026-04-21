"""Passenger WSGI entry — cPanel Python App uses this file.

On cPanel:
  1. Python App → Create Application → set Application Root to the
     directory containing this file.
  2. cPanel creates a virtualenv. Activate it via the "Enter to the virtual
     environment" command printed in the interface, then `pip install -r requirements.txt`.
  3. Restart the app. Passenger imports `application` from this module.

For heavy operations (migrations, seeding) use the cPanel terminal:
    source /home/<user>/virtualenv/rentmate/3.10/bin/activate
    cd /home/<user>/rentmate
    flask db upgrade
"""

import os
import sys

# Ensure the project root is on the import path for `from app import ...`.
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Load .env if present — cPanel user apps don't auto-source a shell profile.
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(PROJECT_ROOT, ".env"))
except Exception:
    pass

# Default to production config on cPanel unless explicitly overridden.
os.environ.setdefault("FLASK_ENV", "production")

from app import create_app  # noqa: E402

application = create_app()
