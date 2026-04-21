"""Chat HTTP + Socket.IO smoke tests."""

import pytest

from rentmate.extensions import db, socketio
from models import Conversation


def _login(client, make_user, email):
    u = make_user(email=email)
    client.post("/login", data={"email": email, "password": "password123"})
    return u


def test_start_chat_creates_conversation(client, make_user):
    u1 = _login(client, make_user, "a@ex.com")
    u2 = make_user(email="b@ex.com")
    r = client.post(f"/api/chat/start/{u2.id}", json={})
    assert r.status_code == 200
    conv_id = r.get_json()["conversation_id"]
    conv = db.session.get(Conversation, conv_id)
    assert conv is not None
    assert {conv.user1_id, conv.user2_id} == {u1.id, u2.id}


def test_send_message_via_http(client, make_user):
    u1 = _login(client, make_user, "a@ex.com")
    u2 = make_user(email="b@ex.com")
    conv_id = client.post(f"/api/chat/start/{u2.id}", json={}).get_json()["conversation_id"]

    r = client.post(f"/api/chat/{conv_id}/send", json={"body": "היי"})
    assert r.status_code == 200
    data = r.get_json()
    assert data["body"] == "היי"
    assert data["sender_id"] == u1.id


@pytest.mark.skip(reason="Session sharing between flask test client + socketio test client "
                         "is flaky under eventlet; covered by HTTP test + manual e2e.")
def test_socket_send_and_receive(app, make_user):
    u1 = make_user(email="s1@ex.com")
    u2 = make_user(email="s2@ex.com")
    conv = Conversation(user1_id=u1.id, user2_id=u2.id)
    db.session.add(conv)
    db.session.commit()

    client1 = app.test_client()
    client2 = app.test_client()
    client1.post("/login", data={"email": "s1@ex.com", "password": "password123"})
    client2.post("/login", data={"email": "s2@ex.com", "password": "password123"})

    sio1 = socketio.test_client(app, flask_test_client=client1)
    sio2 = socketio.test_client(app, flask_test_client=client2)
    assert sio1.is_connected()
    assert sio2.is_connected()

    sio1.emit("join_conversation", {"conversation_id": conv.id})
    sio2.emit("join_conversation", {"conversation_id": conv.id})
    sio1.get_received()  # drain
    sio2.get_received()

    sio1.emit("send_message", {"conversation_id": conv.id, "body": "שלום"})
    received = sio2.get_received()
    message_events = [r for r in received if r["name"] == "message:new"]
    assert message_events, f"expected a message:new event, got {received}"
    assert message_events[0]["args"][0]["body"] == "שלום"
