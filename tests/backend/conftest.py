"""
Session-scoped test client.

Strategy:
  1. Seed the database using an unauthenticated bootstrap client.
  2. Login, capture the JWT.
  3. Yield a second TestClient constructed with that JWT as the default
     Authorization header — so all protected endpoints work by default.

To test unauthenticated/401 behaviour in individual tests, pass a bad token:
    client.get("/api/auth/me", headers={"Authorization": "Bearer bad.token"})
"""
import os

os.environ["DATABASE_URL"] = "sqlite:///./test_groomer.db"
os.environ["SEED_KEY"] = "testkey"
os.environ["ANTHROPIC_API_KEY"] = "test-fake-key"

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    import sys
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent.parent / "backend"))

    from database import Base, engine
    from main import app

    Base.metadata.create_all(bind=engine)

    # Phase 1 — seed with an unauthenticated client
    with TestClient(app) as bootstrap:
        seed_r = bootstrap.post("/api/seed?key=testkey")
        assert seed_r.status_code == 200, f"Seed failed: {seed_r.text}"
        login_r = bootstrap.post(
            "/api/auth/login",
            json={"email": "demo@groomnice.com", "password": "demo1234"},
        )
        assert login_r.status_code == 200, f"Login failed: {login_r.text}"
        token = login_r.json()["token"]

    # Phase 2 — authed client with JWT baked in at construction time
    with TestClient(app, headers={"Authorization": f"Bearer {token}"}) as c:
        yield c

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    import time; time.sleep(0.2)
    if os.path.exists("test_groomer.db"):
        try:
            os.remove("test_groomer.db")
        except PermissionError:
            pass


# ── Auth / groomer fixtures ───────────────────────────────────────────────────

@pytest.fixture(scope="session")
def demo_token(client):
    r = client.post(
        "/api/auth/login",
        json={"email": "demo@groomnice.com", "password": "demo1234"},
    )
    return r.json()["token"]


@pytest.fixture(scope="session")
def groomer_b(client):
    """Second independent groomer for multi-tenant isolation tests."""
    r = client.post("/api/auth/register", json={
        "email": "groomer_b_isolation@example.com",
        "password": "testpass123",
        "name": "Groomer B",
        "slug": "groomer-b-isolation",
    })
    assert r.status_code == 201, f"groomer_b registration failed: {r.text}"
    data = r.json()
    return {"token": data["token"], "id": data["groomer"]["id"], "slug": data["groomer"]["slug"]}


# ── Seeded data fixtures ──────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def first_client(client):
    return client.get("/api/clients").json()[0]


@pytest.fixture(scope="session")
def jane(client):
    clients = client.get("/api/clients").json()
    return next(c for c in clients if c["name"] == "Jane Smith")


@pytest.fixture(scope="session")
def today_appointments(client):
    return client.get("/api/appointments/today").json()
