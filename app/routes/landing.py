"""Landing page + cross-cutting public routes (favicon, kill-switch SW, manifest)."""

from flask import Blueprint, render_template, redirect, url_for, send_from_directory, current_app, Response
from flask_login import current_user

from app.models import Listing, ListingStatus

bp = Blueprint("landing", __name__)


@bp.route("/")
def home():
    if current_user.is_authenticated:
        return redirect(url_for("matches.swipe"))
    active_count = Listing.query.filter_by(status=ListingStatus.ACTIVE).count()
    return render_template("landing.html", active_listings=active_count)


@bp.route("/favicon.ico")
def favicon():
    return send_from_directory(current_app.static_folder, "favicon.ico",
                               mimetype="image/x-icon")


@bp.route("/manifest.webmanifest")
def manifest():
    """Minimal manifest. The current build doesn't ship a full PWA, but we
    return a valid manifest so browsers stop logging 404s."""
    body = (
        '{"name":"RentMate","short_name":"RentMate","start_url":"/",'
        '"display":"browser","background_color":"#ffffff","theme_color":"#FF4458",'
        '"icons":[{"src":"/static/icons/icon-192.png","sizes":"192x192","type":"image/png"},'
        '{"src":"/static/icons/icon-512.png","sizes":"512x512","type":"image/png"}]}'
    )
    return Response(body, mimetype="application/manifest+json")


@bp.route("/service-worker.js")
def service_worker_kill_switch():
    """Kill-switch SW. The previous build registered a PWA service worker that
    keeps trying to fetch stale asset URLs (style.css, rm-core.js, ...). This
    response unregisters every SW currently active for this origin and clears
    the caches the old SW created, then deletes itself. After one reload, the
    browser will stop hitting these 404 paths.
    """
    js = (
        "// kill-switch SW — unregisters any prior service worker + clears caches.\n"
        "self.addEventListener('install', (e) => { self.skipWaiting(); });\n"
        "self.addEventListener('activate', (e) => {\n"
        "  e.waitUntil((async () => {\n"
        "    const keys = await caches.keys();\n"
        "    await Promise.all(keys.map(k => caches.delete(k)));\n"
        "    const regs = await self.registration ? [self.registration] : [];\n"
        "    for (const r of regs) { try { await r.unregister(); } catch(_) {} }\n"
        "    const clients = await self.clients.matchAll({ type: 'window' });\n"
        "    clients.forEach(c => c.navigate(c.url));\n"
        "  })());\n"
        "});\n"
    )
    resp = Response(js, mimetype="application/javascript")
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    return resp
