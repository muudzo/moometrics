"""Animals: CRUD, pagination envelope, per-farm uniqueness, tenant isolation."""

from conftest import auth_header, register_employee, signup


def _create(client, token, **kw):
    body = {"name": "Bessie", "animal_type": "cattle"}
    body.update(kw)
    return client.post("/api/animals", headers=auth_header(token), json=body)


def test_create_and_list_pagination_envelope(client, manager_token):
    _create(client, manager_token, name="A")
    _create(client, manager_token, name="B")
    r = client.get("/api/animals", headers=auth_header(manager_token))
    assert r.status_code == 200
    page = r.json()
    assert set(page) == {"items", "total", "page", "limit"}
    assert page["total"] == 2
    assert page["page"] == 1


def test_pagination_limits_results(client, manager_token):
    for i in range(5):
        _create(client, manager_token, name=f"A{i}", tag_number=f"T{i}")
    r = client.get("/api/animals?page=1&limit=2", headers=auth_header(manager_token))
    page = r.json()
    assert len(page["items"]) == 2
    assert page["total"] == 5


def test_tenant_isolation(client):
    a = signup(client, username="afarm", farm_name="A")
    b = signup(client, username="bfarm", farm_name="B")
    _create(client, a["access_token"], name="A-cow")
    # B sees nothing of A's
    rb = client.get("/api/animals", headers=auth_header(b["access_token"]))
    assert rb.json()["total"] == 0


def test_per_farm_tag_uniqueness(client):
    a = signup(client, username="afarm", farm_name="A")
    b = signup(client, username="bfarm", farm_name="B")
    assert _create(client, a["access_token"], tag_number="A-1").status_code == 201
    # same tag in same farm -> 409
    assert _create(client, a["access_token"], tag_number="A-1").status_code == 409
    # same tag in a DIFFERENT farm is allowed
    assert _create(client, b["access_token"], tag_number="A-1").status_code == 201


def test_update_tag_clash(client, manager_token):
    _create(client, manager_token, name="A", tag_number="T1")
    r2 = _create(client, manager_token, name="B", tag_number="T2")
    aid = r2.json()["id"]
    r = client.put(
        f"/api/animals/{aid}",
        headers=auth_header(manager_token),
        json={"tag_number": "T1"},
    )
    assert r.status_code == 409


def test_employee_cannot_delete(client, manager_token):
    mgr_id_resp = _create(client, manager_token, name="A")
    aid = mgr_id_resp.json()["id"]
    emp = register_employee(client, manager_token, username="hand")
    r = client.delete(f"/api/animals/{aid}", headers=auth_header(emp["access_token"]))
    assert r.status_code == 403


def test_manager_delete_and_cross_farm_404(client):
    a = signup(client, username="afarm", farm_name="A")
    b = signup(client, username="bfarm", farm_name="B")
    aid = _create(client, a["access_token"], name="A-cow").json()["id"]
    # B cannot see or delete A's animal
    assert (
        client.get(
            f"/api/animals/{aid}", headers=auth_header(b["access_token"])
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/animals/{aid}", headers=auth_header(b["access_token"])
        ).status_code
        == 404
    )
    # A can delete its own
    assert (
        client.delete(
            f"/api/animals/{aid}", headers=auth_header(a["access_token"])
        ).status_code
        == 204
    )


def test_csv_export(client, manager_token):
    _create(client, manager_token, name="Bessie", tag_number="A-1")
    r = client.get("/api/animals/export.csv", headers=auth_header(manager_token))
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert "Bessie" in r.text and "A-1" in r.text
