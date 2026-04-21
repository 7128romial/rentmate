"""AI Agent — GPT-4o-mini preference interviewer."""

from datetime import datetime

from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user

from app.extensions import db, limiter, csrf
from app.models import AIConversation
from app.services.openai_service import continue_conversation, kickoff_message

bp = Blueprint("ai_agent", __name__)


@bp.route("/chat")
@login_required
def chat():
    """Render the AI chat UI. Creates a blank conversation if none exists yet."""
    conv = AIConversation.query.filter_by(user_id=current_user.id).order_by(
        AIConversation.created_at.desc()
    ).first()

    if not conv or conv.completed:
        conv = AIConversation(user_id=current_user.id, messages=[], completed=False)
        first = kickoff_message()
        conv.messages = [{"role": "assistant", "content": first,
                          "ts": datetime.utcnow().isoformat()}]
        db.session.add(conv)
        db.session.commit()

    return render_template("ai_agent/chat.html", conversation=conv)


@bp.route("/message", methods=["POST"])
@login_required
@limiter.limit("30 per minute")
def send_message():
    data = request.get_json(silent=True) or {}
    user_text = (data.get("content") or "").strip()
    if not user_text:
        return jsonify({"error": "empty message"}), 400
    if len(user_text) > 2000:
        return jsonify({"error": "message too long"}), 400

    conv = AIConversation.query.filter_by(user_id=current_user.id).order_by(
        AIConversation.created_at.desc()
    ).first()
    if not conv or conv.completed:
        conv = AIConversation(user_id=current_user.id, messages=[], completed=False)
        db.session.add(conv)
        db.session.flush()

    now = datetime.utcnow().isoformat()
    messages = list(conv.messages or [])
    messages.append({"role": "user", "content": user_text, "ts": now})

    assistant_text, is_final, extracted = continue_conversation(
        [{"role": m["role"], "content": m["content"]} for m in messages]
    )

    messages.append({"role": "assistant", "content": assistant_text, "ts": datetime.utcnow().isoformat()})
    conv.messages = messages

    if is_final and extracted:
        conv.completed = True
        conv.extracted_preferences = extracted
        # Mirror into User.preferences so the matching engine can use them
        current_user.preferences = extracted

    db.session.commit()

    return jsonify({
        "assistant": assistant_text,
        "done": is_final,
        "preferences": extracted if is_final else None,
    })


# AI responses are short — keep CSRF default on since the form token is
# exposed by base.html to the fetch wrapper.
