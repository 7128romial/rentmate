def _register(client, email='alice@example.com', password='secret123', name='Alice', role=None):
    payload = {'email': email, 'password': password, 'name': name}
    if role is not None:
        payload['role'] = role
    res = client.post('/api/auth/register', json=payload)
    assert res.status_code == 200, res.data
    body = res.get_json()
    assert body.get('token')
    assert body.get('user_id')
    return body


def _login(client, email='alice@example.com', password='secret123'):
    res = client.post('/api/auth/login', json={'email': email, 'password': password})
    assert res.status_code == 200, res.data
    return res.get_json()


def _auth_token(client, email='alice@example.com'):
    return _register(client, email=email)['token']


def test_register_rejects_short_password(client):
    res = client.post(
        '/api/auth/register',
        json={'email': 'a@b.com', 'password': '123'},
    )
    assert res.status_code == 400


def test_register_rejects_missing_fields(client):
    res = client.post('/api/auth/register', json={'email': '', 'password': ''})
    assert res.status_code == 400


def test_register_returns_token_and_role(client):
    body = _register(client, role='landlord')
    assert body['role'] == 'landlord'
    assert body['profile_complete'] is False


def test_register_unknown_role_falls_back_to_renter(client):
    body = _register(client, email='b@b.com', role='admin')
    assert body['role'] == 'renter'


def test_register_rejects_duplicate_email(client):
    _register(client)
    res = client.post(
        '/api/auth/register',
        json={'email': 'alice@example.com', 'password': 'secret123'},
    )
    assert res.status_code == 400


def test_login_wrong_password_is_401(client):
    _register(client)
    res = client.post(
        '/api/auth/login',
        json={'email': 'alice@example.com', 'password': 'WRONG'},
    )
    assert res.status_code == 401


def test_login_succeeds_and_reports_profile_state(client):
    _register(client)
    body = _login(client)
    assert body.get('token')
    assert body.get('role') == 'renter'
    assert body['profile_complete'] is False


def test_profile_requires_auth(client):
    res = client.post('/api/profile', json={'name': 'X', 'city': 'תל אביב', 'budget': 5000})
    assert res.status_code == 401
    res = client.get('/api/profile')
    assert res.status_code == 401


def test_profile_get_returns_role_and_empty_profile(client):
    token = _auth_token(client)
    res = client.get('/api/profile', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    body = res.get_json()
    assert body['role'] == 'renter'
    assert body['profile_complete'] is False


def test_profile_save_then_login_marks_complete(client):
    token = _auth_token(client)
    res = client.post(
        '/api/profile',
        json={'name': 'דני', 'city': 'תל אביב', 'budget': 5000, 'type': 'לבד', 'extras': 'מרפסת'},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200

    body = _login(client)
    assert body['profile_complete'] is True


def test_profile_can_update_role(client):
    token = _auth_token(client)
    res = client.post(
        '/api/profile',
        json={'role': 'landlord', 'city': 'חיפה', 'budget': 7000},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    assert res.get_json()['role'] == 'landlord'


def test_swipe_never_auto_matches(client, app_ctx):
    app_module, models = app_ctx
    token = _auth_token(client)
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


def test_properties_endpoint_returns_seed_data(client):
    token = _auth_token(client)
    res = client.get('/api/properties', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    items = res.get_json()
    assert isinstance(items, list)
    assert len(items) >= 1
    # Each item exposes the contract the frontend depends on.
    for item in items:
        assert {'id', 'title', 'price', 'image', 'matchScore', 'tags'} <= set(item)


def test_chat_rejects_oversize_payload(client):
    token = _auth_token(client)
    res = client.post(
        '/api/chat',
        json={'text': 'a' * 5000},
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 413


def test_chat_extracts_profile_via_mock_path(client, app_ctx):
    app_module, models = app_ctx
    body = _register(client)
    token = body['token']
    uid = body['user_id']

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


def test_login_throttles_after_many_attempts(client):
    # 10 attempts within 15 minutes is the cap; the 11th should be 429.
    for _ in range(10):
        client.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'x'})
    res = client.post('/api/auth/login', json={'email': 'nobody@example.com', 'password': 'x'})
    assert res.status_code == 429
