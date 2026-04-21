"""Production WSGI entry point for `gunicorn -k eventlet -w 1 wsgi:app`."""

from rentmate import create_app

app = create_app()
