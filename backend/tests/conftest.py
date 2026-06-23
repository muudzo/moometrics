"""
Pytest fixtures: an isolated in-memory database and a TestClient with the
exact dependencies overridden, per the ECC FastAPI testing rules.
"""

import os
import tempfile

# Configure the environment BEFORE app modules import settings/engine.
os.environ.setdefault("RUN_DB_MIGRATIONS", "false")
os.environ.setdefault("JWT_SECRET", "test-secret-not-for-prod")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp(prefix="moometrics-tests-"))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app.main import create_app  # noqa: E402
from app.rate_limit import limiter  # noqa: E402


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def client(engine):
    TestSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    limiter.enabled = False  # isolate behavior from per-IP rate limiting
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    limiter.enabled = True


# --- helpers --------------------------------------------------------------


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def signup(client, username="boss", password="Passw0rd1", farm_name="Acme Farm"):
    """Create a farm + manager; return the parsed token response."""
    r = client.post(
        "/api/auth/signup",
        json={"username": username, "password": password, "farm_name": farm_name},
    )
    assert r.status_code == 201, r.text
    return r.json()


def register_employee(client, manager_token, username="hand", password="Passw0rd1"):
    r = client.post(
        "/api/auth/register",
        headers=auth_header(manager_token),
        json={"username": username, "password": password, "role": "employee"},
    )
    assert r.status_code == 201, r.text
    login = client.post(
        "/api/auth/login", json={"username": username, "password": password}
    )
    assert login.status_code == 200, login.text
    return login.json()


@pytest.fixture
def manager(client):
    return signup(client)


@pytest.fixture
def manager_token(manager):
    return manager["access_token"]
