import json


def _login(client, phone='0501234567'):
    res = client.post('/api/auth/login', json={'phone': phone})
    assert res.status_code == 200, res.data
    body = res.get_json()
    assert 'otp' in body, 'EXPOSE_OTP should be on in tests'
    return body['otp']


def _verify(client, phone='0501234567', otp=None):
    if otp is None:
        otp = _login(client, phone)
    res = client.post('/api/auth/verify', json={'phone': phone, 'otp': otp})
    return res


def test_login_rejects_invalid_phone(client):
    res = client.post('/api/auth/login', json={'phone': ''})
    assert res.status_code == 400
    res = client.post('/api/auth/login', json={'phone': '<script>'})
    assert res.status_code == 400


def test_verify_wrong_otp_is_401(client):
    _login(client)
    res = client.post('/api/auth/verify', json={'phone': '0501234567', 'otp': '0000'})
    assert res.status_code == 401


def test_verify_correct_otp_returns_token(client):
    otp = _login(client)
    res = _verify(client, otp=otp)
    assert res.status_code == 200
    body = res.get_json()
    assert body.get('token')
    assert body.get('user_id')


def test_otp_is_single_use(client):
    otp = _login(client)
    first = _verify(client, otp=otp)
    assert first.status_code == 200
    second = client.post('/api/auth/verify', json={'phone': '0501234567', 'otp': otp})
    assert second.status_code == 401


def test_profile_requires_auth(client):
    res = client.post('/api/profile', json={'name': 'X', 'city': 'תל אביב', 'budget': '5000'})
    assert res.status_code == 401


def test_profile_with_token_succeeds(client):
    otp = _login(client)
    token = _verify(client, otp=otp).get_json()['token']
    res = client.post(
        '/api/profile',
        json={'name': 'דני', 'city': 'תל אביב', 'budget': '5000', 'type': 'לבד', 'extras': 'מרפסת'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200


def test_swipe_never_auto_matches(client, app_ctx):
    _, models = app_ctx
    otp = _login(client)
    token = _verify(client, otp=otp).get_json()['token']
    # Seed a property directly.
    app_module, _ = app_ctx
    with app_module.app.app_context():
        prop = models.Property(title='t', price=4000, location='תל אביב', image='x', tags='a')
        app_module.db.session.add(prop)
        app_module.db.session.commit()
        pid = prop.id

    res = client.post(
        '/api/swipe',
        json={'property_id': pid, 'direction': 'right'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    body = res.get_json()
    assert body['isMatch'] is False
    assert body['interestSent'] is True


def test_chat_rejects_oversize_payload(client):
    otp = _login(client)
    token = _verify(client, otp=otp).get_json()['token']
    res = client.post(
        '/api/chat',
        json={'text': 'a' * 5000},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 413


def test_chat_extracts_profile_via_mock_path(client, app_ctx):
    app_module, models = app_ctx
    otp = _login(client)
    body = _verify(client, otp=otp).get_json()
    token = body['token']
    uid = body['user_id']

    # The mock branch fires when the message contains 'תל אביב' or '5000'.
    res = client.post(
        '/api/chat',
        json={'text': 'אני רוצה דירה בתל אביב ב-5000 שקל'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    data = res.get_json()
    assert data['profile_complete'] is True

    with app_module.app.app_context():
        profile = models.PreferenceProfile.query.filter_by(user_id=uid).first()
        assert profile is not None
        assert profile.city == 'תל אביב'
        assert profile.max_budget == 5000
