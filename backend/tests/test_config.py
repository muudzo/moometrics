"""Config: production guards refuse insecure defaults (fail-fast on boot)."""

import pytest

from app.config import Settings


def _prod(**over):
    base = dict(
        environment="production",
        jwt_secret="a-strong-secret-of-sufficient-length-1234567890",
        database_url="postgresql://u:p@h/db",
        admin_initial_password="A-strong-pass1",
    )
    base.update(over)
    return base


def test_production_rejects_default_jwt_secret():
    with pytest.raises(ValueError, match="JWT_SECRET"):
        Settings(**_prod(jwt_secret="change-me-in-production"))


def test_production_rejects_short_jwt_secret():
    with pytest.raises(ValueError, match="at least 32 characters"):
        Settings(**_prod(jwt_secret="too-short"))


def test_production_rejects_sqlite():
    with pytest.raises(ValueError, match="SQLite"):
        Settings(**_prod(database_url="sqlite:///./moometrics.db"))


def test_production_rejects_default_admin_password():
    with pytest.raises(ValueError, match="ADMIN_INITIAL_PASSWORD"):
        Settings(**_prod(admin_initial_password="admin123"))


def test_production_accepts_strong_config():
    s = Settings(**_prod())
    assert s.is_production is True
