"""Auth: signup/login, refresh rotation, lockout, timing-safe, password change."""

from conftest import auth_header, register_employee, signup


def test_signup_creates_farm_and_manager_with_refresh_cookie(client):
    data = signup(client, username="boss", farm_name="Green Acres")
    assert data["role"] == "manager"
    assert data["farm_name"] == "Green Acres"
    assert data["access_token"]
    assert "moometrics_refresh" in client.cookies


def test_signup_duplicate_username_conflicts(client):
    signup(client, username="boss")
    r = client.post(
        "/api/auth/signup",
        json={"username": "boss", "password": "Passw0rd1", "farm_name": "Other"},
    )
    assert r.status_code == 409


def test_signup_rejects_weak_password(client):
    r = client.post(
        "/api/auth/signup",
        json={"username": "weaky", "password": "alllowercase", "farm_name": "F"},
    )
    assert r.status_code == 422  # missing uppercase + digit


def test_login_success_and_wrong_password(client):
    signup(client, username="boss", password="Passw0rd1")
    assert (
        client.post(
            "/api/auth/login", json={"username": "boss", "password": "Passw0rd1"}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/auth/login", json={"username": "boss", "password": "nope"}
        ).status_code
        == 401
    )


def test_login_unknown_user_is_401_not_404(client):
    # Timing-safe path: a missing user looks identical to a wrong password.
    r = client.post(
        "/api/auth/login", json={"username": "ghost", "password": "Passw0rd1"}
    )
    assert r.status_code == 401


def test_refresh_rotates_and_revokes_old_token(client):
    signup(client)
    old = client.cookies.get("moometrics_refresh")
    r = client.post("/api/auth/refresh")
    assert r.status_code == 200
    new = client.cookies.get("moometrics_refresh")
    assert old != new
    # Re-presenting the rotated-away token must fail.
    client.cookies.clear()
    client.cookies.set("moometrics_refresh", old)
    assert client.post("/api/auth/refresh").status_code == 401


def test_logout_revokes_session(client):
    signup(client)
    assert client.post("/api/auth/logout").status_code == 204
    # cookie cleared; refresh now fails
    assert client.post("/api/auth/refresh").status_code == 401


def test_account_lockout_after_failed_attempts(client):
    signup(client, username="boss", password="Passw0rd1")
    for _ in range(5):
        client.post("/api/auth/login", json={"username": "boss", "password": "bad"})
    # Even the correct password is now refused.
    r = client.post(
        "/api/auth/login", json={"username": "boss", "password": "Passw0rd1"}
    )
    assert r.status_code == 403
    assert "locked" in r.json()["detail"].lower()


def test_password_change_requires_current_and_invalidates_old(client):
    data = signup(client, username="boss", password="Passw0rd1")
    h = auth_header(data["access_token"])
    # wrong current password
    assert (
        client.put(
            "/api/auth/password",
            headers=h,
            json={"current_password": "wrong", "new_password": "Newpass99"},
        ).status_code
        == 400
    )
    assert (
        client.put(
            "/api/auth/password",
            headers=h,
            json={"current_password": "Passw0rd1", "new_password": "Newpass99"},
        ).status_code
        == 204
    )
    assert (
        client.post(
            "/api/auth/login", json={"username": "boss", "password": "Passw0rd1"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login", json={"username": "boss", "password": "Newpass99"}
        ).status_code
        == 200
    )


def test_register_employee_joins_manager_farm(client):
    mgr = signup(client, username="boss", farm_name="Acme")
    emp = register_employee(client, mgr["access_token"], username="hand")
    assert emp["role"] == "employee"
    assert emp["farm_id"] == mgr["farm_id"]


def test_register_requires_manager(client):
    mgr = signup(client)
    emp = register_employee(client, mgr["access_token"], username="hand")
    # employee cannot register others
    r = client.post(
        "/api/auth/register",
        headers=auth_header(emp["access_token"]),
        json={"username": "x", "password": "Passw0rd1", "role": "employee"},
    )
    assert r.status_code == 403
