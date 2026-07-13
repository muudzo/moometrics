"""Deaths: report flow, per-farm image dedup, status transition, isolation."""

import io

from PIL import Image

from conftest import auth_header, register_employee, signup


def _png(seed: int = 0) -> bytes:
    """Generate a tiny but *real* PNG. Distinct seeds -> distinct bytes/hash."""
    buf = io.BytesIO()
    color = (seed % 256, (seed * 7) % 256, (seed * 13) % 256)
    Image.new("RGB", (8, 8), color).save(buf, format="PNG")
    return buf.getvalue()


def _animal(client, token, **kw):
    body = {"name": "Bessie", "animal_type": "cattle"}
    body.update(kw)
    return client.post("/api/animals", headers=auth_header(token), json=body).json()


def _report(client, token, animal_id, image=None, cause="illness"):
    if image is None:
        image = _png(0)
    return client.post(
        "/api/deaths",
        headers=auth_header(token),
        data={
            "animal_id": str(animal_id),
            "cause_of_death": cause,
            "date_of_death": "2026-01-01",
        },
        files={"file": ("photo.png", image, "image/png")},
    )


def test_report_death_marks_animal_dead(client, manager_token):
    animal = _animal(client, manager_token)
    r = _report(client, manager_token, animal["id"])
    assert r.status_code == 201, r.text
    assert r.json()["farm_id"] == animal["farm_id"]
    # animal now dead
    a = client.get(
        f"/api/animals/{animal['id']}", headers=auth_header(manager_token)
    ).json()
    assert a["status"] == "dead"


def test_duplicate_image_rejected_within_farm(client, manager_token):
    a1 = _animal(client, manager_token, name="A", tag_number="A-1")
    a2 = _animal(client, manager_token, name="B", tag_number="A-2")
    same = _png(1)
    assert _report(client, manager_token, a1["id"], image=same).status_code == 201
    r = _report(client, manager_token, a2["id"], image=same)
    assert r.status_code == 409


def test_same_image_allowed_across_farms(client):
    a = signup(client, username="afarm", farm_name="A")
    b = signup(client, username="bfarm", farm_name="B")
    aa = _animal(client, a["access_token"])
    ba = _animal(client, b["access_token"])
    shared = _png(2)
    assert _report(client, a["access_token"], aa["id"], image=shared).status_code == 201
    # farm B can reuse the identical photo
    assert _report(client, b["access_token"], ba["id"], image=shared).status_code == 201


def test_cannot_report_twice_for_same_animal(client, manager_token):
    animal = _animal(client, manager_token)
    assert (
        _report(client, manager_token, animal["id"], image=_png(3)).status_code == 201
    )
    r = _report(client, manager_token, animal["id"], image=_png(4))
    assert r.status_code == 400  # already dead


def test_unsupported_file_type_rejected(client, manager_token):
    animal = _animal(client, manager_token)
    r = client.post(
        "/api/deaths",
        headers=auth_header(manager_token),
        data={
            "animal_id": str(animal["id"]),
            "cause_of_death": "x",
            "date_of_death": "2026-01-01",
        },
        files={"file": ("doc.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 400


def test_disguised_html_rejected(client, manager_token):
    """A non-image with a spoofed image content-type must be rejected, so it can
    never be stored/served as active content (stored-XSS defense)."""
    animal = _animal(client, manager_token)
    r = client.post(
        "/api/deaths",
        headers=auth_header(manager_token),
        data={
            "animal_id": str(animal["id"]),
            "cause_of_death": "x",
            "date_of_death": "2026-01-01",
        },
        # Looks like a PNG by header, is actually HTML with a dangerous name.
        files={"file": ("evil.html", b"<script>alert(1)</script>", "image/png")},
    )
    assert r.status_code == 400


def test_check_hash_endpoint(client, manager_token):
    import hashlib

    animal = _animal(client, manager_token)
    known = _png(5)
    _report(client, manager_token, animal["id"], image=known)
    h = hashlib.sha256(known).hexdigest()
    r = client.get(
        f"/api/deaths/check-hash?hash={h}", headers=auth_header(manager_token)
    )
    assert r.status_code == 200 and r.json()["exists"] is True
    other = hashlib.sha256(b"unseen").hexdigest()
    r2 = client.get(
        f"/api/deaths/check-hash?hash={other}", headers=auth_header(manager_token)
    )
    assert r2.json()["exists"] is False


def test_employee_sees_only_own_deaths(client, manager_token):
    emp = register_employee(client, manager_token, username="hand")
    a1 = _animal(client, manager_token, name="mgr-cow", tag_number="M1")
    a2 = _animal(client, manager_token, name="emp-cow", tag_number="E1")
    _report(client, manager_token, a1["id"], image=_png(6))
    _report(client, emp["access_token"], a2["id"], image=_png(7))
    # manager sees both
    assert (
        client.get("/api/deaths", headers=auth_header(manager_token)).json()["total"]
        == 2
    )
    # employee sees only their own
    assert (
        client.get("/api/deaths", headers=auth_header(emp["access_token"])).json()[
            "total"
        ]
        == 1
    )


def test_deaths_csv_export(client, manager_token):
    animal = _animal(client, manager_token)
    _report(client, manager_token, animal["id"], cause="pneumonia")
    r = client.get("/api/deaths/export.csv", headers=auth_header(manager_token))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "pneumonia" in r.text


def test_cannot_report_on_other_farms_animal(client):
    a = signup(client, username="afarm", farm_name="A")
    b = signup(client, username="bfarm", farm_name="B")
    a_animal = _animal(client, a["access_token"])
    # B tries to report a death on A's animal -> 404 (not visible)
    r = _report(client, b["access_token"], a_animal["id"])
    assert r.status_code == 404
