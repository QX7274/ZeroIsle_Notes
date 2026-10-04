"""管理员与角色管理接口测试（AdminManagement 页面的后端）。

锁定的真实缺陷：
  前端 SystemSettings/AdminManagement.js 调用 /settings/admins 与 /settings/roles，
  但后端此前**完全没有这两个接口**，页面只能靠内部 mock 兜底 ——
  用户看到的是假的管理员列表。

设计口径（与方案 B 一致）：
  管理员 = users 集合中 is_staff/is_superuser 的用户，不是新增的管理员表。
"""

import pytest
from rest_framework.test import APIClient

from users.models import UserProfile


def _mk(username, **kwargs):
    user = UserProfile.objects(username=username).first()
    if user is None:
        user = UserProfile(username=username, email=f"{username}@example.com", **kwargs)
        user.save()
    return user


@pytest.fixture(scope="module")
def client():
    """以管理员身份登录。"""
    from django.contrib.auth.hashers import make_password

    admin = _mk("mgr_admin", is_staff=True)
    UserProfile.objects(id=admin.id).update(password=make_password("Passw0rd!23"))
    # 普通用户，用于验证"只有管理员才是管理员"
    _mk("mgr_normal", is_staff=False)

    api = APIClient()
    resp = api.post(
        "/api/auth/login/",
        {"username": "mgr_admin", "password": "Passw0rd!23"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    api.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])
    return api


def test_admins_endpoint_exists_and_is_paginated(client):
    resp = client.get("/api/settings/admins/")
    assert resp.status_code == 200, getattr(resp, "data", None)
    assert "count" in resp.data and "results" in resp.data


def test_admins_list_only_contains_staff(client):
    """列表只应出现管理员，不能混入普通用户。"""
    resp = client.get("/api/settings/admins/?page_size=200")
    usernames = [a["username"] for a in resp.data["results"]]
    assert "mgr_admin" in usernames
    assert "mgr_normal" not in usernames


def test_admin_payload_matches_frontend_contract(client):
    """字段必须与前端 mockAdmins 的形状一致，避免前端再适配。"""
    resp = client.get("/api/settings/admins/?page_size=200")
    item = next(a for a in resp.data["results"] if a["username"] == "mgr_admin")
    for key in ("id", "username", "email", "role", "status", "lastLogin", "createdAt"):
        assert key in item, f"缺少字段 {key}"
    assert item["role"] in ("superadmin", "admin")
    assert item["status"] in ("active", "inactive")


def test_promote_existing_user_to_admin(client):
    """新增管理员 = 把已有用户提升，而不是新建账号。"""
    _mk("promote_me", is_staff=False)
    resp = client.post(
        "/api/settings/admins/",
        {"username": "promote_me", "role": "admin"},
        format="json",
    )
    assert resp.status_code == 201, getattr(resp, "data", None)
    assert resp.data["data"]["role"] == "admin"
    assert UserProfile.objects(username="promote_me").first().is_staff is True


def test_create_admin_rejects_unknown_user(client):
    """不存在的用户应明确报错，而不是静默创建账号。"""
    resp = client.post(
        "/api/settings/admins/",
        {"username": "no_such_user_xyz", "role": "admin"},
        format="json",
    )
    assert resp.status_code == 400
    assert "不存在" in str(resp.data.get("error", ""))


def test_remove_admin_keeps_user(client):
    """移除管理员只取消标记，**不删除用户**（避免误删业务账号）。"""
    target = _mk("demote_me", is_staff=True)
    resp = client.delete(f"/api/settings/admins/{target.id}/")
    assert resp.status_code == 200, getattr(resp, "data", None)
    refreshed = UserProfile.objects(id=target.id).first()
    assert refreshed is not None, "用户被删除了 —— 应该只取消管理员标记"
    assert refreshed.is_staff is False


def test_cannot_remove_self(client):
    """不能取消自己的管理员权限，避免把自己锁在外面。"""
    me = UserProfile.objects(username="mgr_admin").first()
    resp = client.delete(f"/api/settings/admins/{me.id}/")
    assert resp.status_code == 400
    assert UserProfile.objects(id=me.id).first().is_staff is True


def test_roles_endpoint_is_read_only_and_honest(client):
    """角色接口应如实返回两档并声明不支持自定义。"""
    resp = client.get("/api/settings/roles/")
    assert resp.status_code == 200, getattr(resp, "data", None)
    assert resp.data["can_customize"] is False
    ids = [r["id"] for r in resp.data["results"]]
    assert "superadmin" in ids and "admin" in ids


def test_role_creation_is_rejected_explicitly(client):
    """不支持自定义角色时，必须明确拒绝而不是假装成功。"""
    resp = client.post("/api/settings/roles/", {"name": "x"}, format="json")
    assert resp.status_code == 400
    assert "不支持自定义角色" in str(resp.data.get("error", ""))


def test_non_admin_cannot_access(client):
    """非管理员即使有有效令牌也不能访问管理员管理接口。"""
    from django.contrib.auth.hashers import make_password
    from rest_framework_simplejwt.tokens import RefreshToken

    normal = _mk("mgr_normal2", is_staff=False)
    UserProfile.objects(id=normal.id).update(password=make_password("Passw0rd!23"))

    api = APIClient()
    login = api.post(
        "/api/auth/login/",
        {"username": "mgr_normal2", "password": "Passw0rd!23"},
        format="json",
    )
    # 非 staff 无法登录管理后台（方案 B 的口径）
    assert login.status_code in (401, 403)

    # 即便手工签发令牌，也必须被拒
    token = str(RefreshToken.for_user(normal).access_token)
    api.credentials(HTTP_AUTHORIZATION="Bearer " + token)
    resp = api.get("/api/settings/admins/")
    assert resp.status_code in (401, 403)
