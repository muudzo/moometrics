"""Audit trail: records mutations, manager-only, farm-scoped."""

from conftest import auth_header, register_employee, signup


def _animal(client, token, **kw):
    body = {"name": "Bessie", "animal_type": "cattle"}
    body.update(kw)
    return client.post("/api/animals", headers=auth_header(token), json=body).json()


def test_audit_records_create_update_delete(client, manager_token):
    animal = _animal(client, manager_token)
    client.put(
        f"/api/animals/{animal['id']}",
        headers=auth_header(manager_token),
        json={"notes": "checked"},
    )
    client.delete(f"/api/animals/{animal['id']}", headers=auth_header(manager_token))
    r = client.get("/api/audit", headers=auth_header(manager_token))
    assert r.status_code == 200
    actions = {(a["action"], a["entity_type"]) for a in r.json()["items"]}
    assert {("create", "animal"), ("update", "animal"), ("delete", "animal")} <= actions


def test_audit_is_manager_only(client, manager_token):
    emp = register_employee(client, manager_token, username="hand")
    r = client.get("/api/audit", headers=auth_header(emp["access_token"]))
    assert r.status_code == 403


def test_audit_scoped_to_farm(client):
    a = signup(client, username="aboss", farm_name="A")
    b = signup(client, username="bboss", farm_name="B")
    _animal(client, a["access_token"], name="A-cow")
    # B's audit log must not contain A's actions
    rb = client.get("/api/audit", headers=auth_header(b["access_token"]))
    entities = [(x["action"], x["entity_type"]) for x in rb.json()["items"]]
    assert ("create", "animal") not in entities


def test_audit_records_actor(client, manager):
    _animal(client, manager["access_token"], name="x")
    r = client.get("/api/audit", headers=auth_header(manager["access_token"]))
    entry = next(e for e in r.json()["items"] if e["entity_type"] == "animal")
    assert entry["actor_username"] == "boss"
    assert entry["actor_user_id"] == manager["user_id"]
