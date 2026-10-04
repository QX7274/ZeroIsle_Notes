"""分页契约测试：page / page_size / pageSize 必须真正生效。

锁定的真实缺陷：
  DRF 的 PageNumberPagination 只认 `page_size`（下划线），
  而管理后台前端统一发送 camelCase 的 `pageSize`，
  两者对不上 → 前端传的每页条数被**静默忽略**，永远返回默认 10 条。
  用户翻页时看到的条数与设置不符，且没有任何报错，属难发现的集成缺陷。
"""

import pytest
from rest_framework.test import APIClient

from users.models import UserProfile


@pytest.fixture(scope="module")
def client():
    """登录并准备 25 条数据（足够验证分页）。"""
    from django.contrib.auth.hashers import make_password

    username = "page_smoke_admin"
    user = UserProfile.objects(username=username).first()
    if user is None:
        user = UserProfile(username=username, email="page_smoke@example.com")
        user.is_staff = True
        user.save()
    UserProfile.objects(id=user.id).update(password=make_password("Passw0rd!23"))

    for i in range(25):
        name = f"pagedata{i:02d}"
        if not UserProfile.objects(username=name).first():
            UserProfile(username=name, email=f"{name}@example.com").save()

    api = APIClient()
    resp = api.post(
        "/api/auth/login/",
        {"username": username, "password": "Passw0rd!23"},
        format="json",
    )
    assert resp.status_code == 200, resp.data
    api.credentials(HTTP_AUTHORIZATION="Bearer " + resp.data["data"]["access"])
    return api


PAGE_ENDPOINTS = [
    "/api/users/profiles/",
    "/api/content/categories/",
    "/api/content/notes/",
    "/api/settings/announcements/",
    "/api/logs/admin-logs/",
    "/api/analytics/reports/",
]


@pytest.mark.parametrize("path", PAGE_ENDPOINTS)
def test_page_size_snake_case_is_respected(client, path):
    """page_size 必须生效。"""
    resp = client.get(f"{path}?page=1&page_size=5")
    assert resp.status_code == 200, getattr(resp, "data", None)
    assert len(resp.data["results"]) <= 5, resp.data.get("results")


@pytest.mark.parametrize("path", PAGE_ENDPOINTS)
def test_page_size_camel_case_is_respected(client, path):
    """pageSize（前端实际使用的写法）必须同样生效。

    这是本轮修复的核心点：修复前该参数被静默忽略，永远返回 10 条。
    """
    resp = client.get(f"{path}?page=1&pageSize=5")
    assert resp.status_code == 200, getattr(resp, "data", None)
    returned = len(resp.data["results"])
    assert returned <= 5, (
        f"{path} 传 pageSize=5 但返回了 {returned} 条 —— 说明 pageSize 未被识别"
    )


def test_pagination_limits_are_consistent(client):
    """同一端点上 page_size 与 pageSize 应产生一致的结果。"""
    a = client.get("/api/users/profiles/?page=1&page_size=5")
    b = client.get("/api/users/profiles/?page=1&pageSize=5")
    assert len(a.data["results"]) == len(b.data["results"])


def test_oversized_page_size_is_clamped(client):
    """超大 page_size 应被上限约束，而不是一次性返回全部数据。"""
    resp = client.get("/api/users/profiles/?page=1&page_size=100000")
    assert resp.status_code == 200
    assert len(resp.data["results"]) <= 200


def test_invalid_page_size_falls_back_to_default(client):
    """非法 page_size 不得导致 500，应回退默认值。"""
    resp = client.get("/api/users/profiles/?page=1&page_size=abc")
    assert resp.status_code == 200
    assert len(resp.data["results"]) > 0


def test_bad_page_number_does_not_500(client):
    """非法页码返回 4xx 而非 5xx。"""
    resp = client.get("/api/users/profiles/?page=abc")
    assert resp.status_code < 500, resp.status_code


def test_pagination_class_configured():
    """settings 必须指向自建分页类（否则两种参数名不会同时生效）。"""
    from django.conf import settings

    assert settings.REST_FRAMEWORK.get("DEFAULT_PAGINATION_CLASS") == (
        "common.filters.MongoPageNumberPagination"
    )