FROM python:3.12-slim AS build

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.12-slim

WORKDIR /app
COPY --from=build /install /usr/local

# Non-root user
RUN useradd -m -u 1000 rentmate && mkdir -p /app/static/uploads && chown -R rentmate:rentmate /app
USER rentmate

COPY --chown=rentmate:rentmate . .

ENV FLASK_ENV=prod \
    PYTHONUNBUFFERED=1 \
    PORT=8000

EXPOSE 8000

# Single eventlet worker is required for Socket.IO with in-memory presence.
# For multi-worker, set REDIS_URL and SOCKETIO_MESSAGE_QUEUE to share state.
CMD ["gunicorn", "-k", "eventlet", "-w", "1", "-b", "0.0.0.0:8000", "wsgi:app"]
