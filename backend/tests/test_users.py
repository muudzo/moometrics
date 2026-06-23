"""Users: manager-only listing/deletion scoped to the farm."""

from conftest import auth_header, register_employee, signup


def test_list_users_scoped_to_farm(client):
    a = signup(client, username="aboss", farm_name="A")
    register_employee(client, a["access_token"], username="ahand")
    b = signup(client, username="bboss", farm_name="B")
    register_employee(client, b["access_token"], username="bhand")

    ra = client.get("/api/users", headers=auth_header(a["access_token"]))
    usernames = {u["username"] for u in ra.json()}
    assert usernames == {"aboss", "ahand"}


def test_employee_cannot_list_users(client, manager_token):
    emp = register_employee(client, manager_token, username="hand")
    r = client.get("/api/users", headers=auth_header(emp["access_token"]))
    assert r.status_code == 403


def test_manager_cannot_delete_self(client, manager):
    r = client.delete(
        f"/api/users/{manager['user_id']}",
        headers=auth_header(manager["access_token"]),
    )
    assert r.status_code == 400


def test_delete_user_in_farm(client, manager_token):
    emp = register_employee(client, manager_token, username="hand")
    r = client.delete(
        f"/api/users/{emp['user_id']}", headers=auth_header(manager_token)
    )
    assert r.status_code == 204


def test_cannot_delete_user_in_another_farm(client):
    a = signup(client, username="aboss", farm_name="A")
    b = signup(client, username="bboss", farm_name="B")
    b_emp = register_employee(client, b["access_token"], username="bhand")
    r = client.delete(
        f"/api/users/{b_emp['user_id']}", headers=auth_header(a["access_token"])
    )
    assert r.status_code == 404
