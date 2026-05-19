"""Integration tests for auth: register, login, /auth/me, JWT validation."""


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ── Register ──────────────────────────────────────────────────────────────────

def test_register_returns_token_and_groomer(client):
    r = client.post("/api/auth/register", json={
        "email": "auth_test_new@example.com",
        "password": "securepass",
        "name": "Auth Test",
        "slug": "auth-test-new",
    })
    assert r.status_code == 201
    body = r.json()
    assert "token" in body
    assert body["groomer"]["email"] == "auth_test_new@example.com"
    assert body["groomer"]["slug"] == "auth-test-new"


def test_register_duplicate_email_409(client):
    client.post("/api/auth/register", json={
        "email": "dup_email_auth@example.com", "password": "x",
        "name": "Dup", "slug": "dup-email-auth-1",
    })
    r = client.post("/api/auth/register", json={
        "email": "dup_email_auth@example.com", "password": "x",
        "name": "Dup2", "slug": "dup-email-auth-2",
    })
    assert r.status_code == 409
    assert "email" in r.json()["detail"].lower()


def test_register_duplicate_slug_409(client):
    client.post("/api/auth/register", json={
        "email": "dup_slug_auth_a@example.com", "password": "x",
        "name": "A", "slug": "dup-slug-auth-test",
    })
    r = client.post("/api/auth/register", json={
        "email": "dup_slug_auth_b@example.com", "password": "x",
        "name": "B", "slug": "dup-slug-auth-test",
    })
    assert r.status_code == 409
    assert "slug" in r.json()["detail"].lower()


def test_register_token_is_immediately_usable(client):
    r = client.post("/api/auth/register", json={
        "email": "imm_usable@example.com", "password": "x",
        "name": "Imm", "slug": "imm-usable",
    })
    assert r.status_code == 201
    token = r.json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "imm_usable@example.com"


# ── Login ─────────────────────────────────────────────────────────────────────

def test_login_valid_returns_token(client):
    r = client.post("/api/auth/login", json={
        "email": "demo@groomnice.com", "password": "demo1234",
    })
    assert r.status_code == 200
    assert "token" in r.json()
    assert r.json()["groomer"]["email"] == "demo@groomnice.com"


def test_login_wrong_password_401(client):
    r = client.post("/api/auth/login", json={
        "email": "demo@groomnice.com", "password": "badpassword",
    })
    assert r.status_code == 401


def test_login_nonexistent_email_401(client):
    r = client.post("/api/auth/login", json={
        "email": "nobody@nowhere.example", "password": "x",
    })
    assert r.status_code == 401


# ── /auth/me ──────────────────────────────────────────────────────────────────

def test_auth_me_returns_groomer_fields(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    body = r.json()
    for field in ("id", "email", "name", "slug"):
        assert field in body, f"Missing field: {field}"
    assert body["email"] == "demo@groomnice.com"


def test_auth_me_no_token_401(client):
    r = client.get("/api/auth/me", headers={"Authorization": ""})
    assert r.status_code == 401


def test_auth_me_bad_token_401(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"})
    assert r.status_code == 401


def test_protected_endpoint_no_token_401(client):
    r = client.get("/api/clients", headers={"Authorization": ""})
    assert r.status_code == 401


def test_protected_endpoint_bad_token_401(client):
    r = client.get("/api/appointments/today", headers={"Authorization": "Bearer not.a.real.token"})
    assert r.status_code == 401
