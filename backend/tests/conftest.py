"""
Pytest fixtures for SecureCollab AI backend tests.
Uses an in-memory SQLite database (StaticPool) so every test function
gets a fully isolated, fresh database state.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import from backend root (tests are run with backend/ as cwd)
from database import Base, get_db
from main import app


@pytest.fixture(scope="function")
def client():
    """
    Yields a TestClient backed by a fresh in-memory SQLite database.
    StaticPool ensures the same in-memory DB is reused across connections
    within a single test (required for FastAPI's thread-per-request model).
    """
    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=test_engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


# ─── Convenience helpers ───────────────────────────────────────────────────────

def register_user(client, email, username, password="password123", role="student"):
    r = client.post("/api/auth/register", json={
        "email": email,
        "username": username,
        "password": password,
        "role": role,
    })
    assert r.status_code == 201, r.text
    return r.json()


def login_and_get_token(client, email, password="password123"):
    """Perform full login + 2FA flow and return the JWT."""
    login_r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_r.status_code == 200, login_r.text
    otp = login_r.json()["otp_for_demo"]

    verify_r = client.post("/api/auth/verify-2fa", json={"email": email, "otp": otp})
    assert verify_r.status_code == 200, verify_r.text
    return verify_r.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
