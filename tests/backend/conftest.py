"""
Must be loaded before any app imports — sets test DATABASE_URL at module level.
"""
import os
os.environ["DATABASE_URL"] = "sqlite:///./test_groomer.db"
os.environ["SEED_KEY"] = "testkey"
os.environ["ANTHROPIC_API_KEY"] = "test-fake-key"  # prevents real OCR calls

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="session")
def client():
    import sys
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent.parent / "backend"))

    from database import Base, engine
    from main import app

    Base.metadata.create_all(bind=engine)

    with TestClient(app) as c:
        r = c.post("/api/seed?key=testkey")
        assert r.status_code == 200, f"Seed failed: {r.text}"
        yield c

    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    import time; time.sleep(0.2)
    if os.path.exists("test_groomer.db"):
        try:
            os.remove("test_groomer.db")
        except PermissionError:
            pass  # Windows file lock; file will be cleaned up on next run


@pytest.fixture(scope="session")
def first_client(client):
    """Returns the first client from the seeded DB."""
    clients = client.get("/api/clients").json()
    return clients[0]


@pytest.fixture(scope="session")
def jane(client):
    """Returns Jane Smith (has 2 pets in seed)."""
    clients = client.get("/api/clients").json()
    return next(c for c in clients if c["name"] == "Jane Smith")


@pytest.fixture(scope="session")
def today_appointments(client):
    return client.get("/api/appointments/today").json()
