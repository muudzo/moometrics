"""Dashboard: farm-scoped aggregate statistics."""

from conftest import auth_header, signup


def _animal(client, token, **kw):
    body = {"name": "Bessie", "animal_type": "cattle"}
    body.update(kw)
    return client.post("/api/animals", headers=auth_header(token), json=body).json()


def test_stats_scoped_and_counted(client):
    a = signup(client, username="aboss", farm_name="A")
    b = signup(client, username="bboss", farm_name="B")
    _animal(client, a["access_token"], name="c1", animal_type="cattle", tag_number="1")
    _animal(client, a["access_token"], name="s1", animal_type="sheep", tag_number="2")
    _animal(client, b["access_token"], name="bx", animal_type="goat", tag_number="1")

    r = client.get("/api/dashboard/stats", headers=auth_header(a["access_token"]))
    assert r.status_code == 200
    stats = r.json()
    assert stats["total_animals"] == 2  # only farm A
    assert stats["alive_count"] == 2
    assert stats["dead_count"] == 0
    assert stats["type_breakdown"] == {"cattle": 1, "sheep": 1}
    assert len(stats["recent_activity"]) == 2


def test_empty_farm_stats(client, manager_token):
    r = client.get("/api/dashboard/stats", headers=auth_header(manager_token))
    stats = r.json()
    assert stats["total_animals"] == 0
    assert stats["death_rate"] == 0.0
